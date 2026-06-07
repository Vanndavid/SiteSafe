import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { Header } from './components/Header';
import { UploadArea } from './components/UploadArea';
import { DocumentList } from './components/DocumentList';
import { NotificationPanel } from './components/NotificationPanel';
import { useAuth, api } from './auth/AuthContext';
import type { DocumentItem, NotificationItem } from './types';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Fab, Tooltip } from '@mui/material';
import LandingPage from './components/LandingPage';

interface UploadUrlResponse {
  documentId: string;
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);

  const fetchDocuments = async () => {
    const res = await api.get('/api/documents');
    setDocuments(res.data);
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setDocuments([]);
      setNotifications([]);
      return;
    }

    void fetchDocuments();
    void fetchNotifications();
  }, [isAuthenticated]);

  const searchDocuments = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      await fetchDocuments();
      setSearchSummary(null);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const res = await api.get('/api/documents/search', { params: { q: trimmedQuery } });
      const data = res.data;
      setDocuments(data.results);

      const keywordSummary = data.interpretedFilters.keywords.length
        ? `keywords: ${data.interpretedFilters.keywords.join(', ')}`
        : 'no keyword filters';
      const expirySummary = data.interpretedFilters.expiryWithinDays
        ? `expiry within ${data.interpretedFilters.expiryWithinDays} days`
        : 'no expiry window';

      setSearchSummary(`Found ${data.results.length} matching document(s) using ${keywordSummary} and ${expirySummary}.`);
    } catch {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = async () => {
    setSearchQuery('');
    setSearchSummary(null);
    setError(null);
    await fetchDocuments();
  };

  const pollForStatus = (docId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/document/${docId}`);
        const data = res.data;

        if (data.status === 'processed' || data.status === 'failed') {
          clearInterval(interval);

          setDocuments(prev =>
            prev.map(doc =>
              doc.id === docId
                ? { ...doc, status: data.status, extraction: data.extraction }
                : doc
            )
          );
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 5000);
  };

  const handleNotificationRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n._id !== id));
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const uploadUrlRes = await api.post<UploadUrlResponse>('/api/documents/upload-url', {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const { documentId, key, uploadUrl } = uploadUrlRes.data;
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!s3Res.ok) {
        throw new Error('S3 upload failed');
      }

      const completeRes = await api.post(`/api/documents/${documentId}/complete-upload`);
      const data = completeRes.data;

      setDocuments(prev => [
        { id: data.file.id, name: data.file.originalName, status: 'pending', storagePath: data.file.key ?? key },
        ...prev
      ]);
      pollForStatus(data.file.id);
    } catch (err) {
      console.error('Upload failed', err);
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#f5f5f5">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box minHeight="100vh" bgcolor="#f5f5f5">
      <Header />

      {isAuthenticated ? (
        <Container maxWidth="md" sx={{ mt: 6 }}>
          <Typography variant="h3" textAlign="center" fontWeight="bold" mb={4}>
            AI Compliance Officer
          </Typography>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Automatically extracts expiry dates from uploaded documents, monitors them continuously, and reminds users before deadlines (e.g. 30 days before expiry) to reduce compliance risk and operational disruption.
            <Button
              variant="text"
              component="a"
              href="/Sample.pdf"
              download="Sample_Document.pdf"
              sx={{ ml: 1, textTransform: 'none', verticalAlign: 'baseline' }}
            >
              Download Sample
            </Button>
          </Typography>

          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight="bold">
                Search your uploaded files in chat
              </Typography>
              <Typography color="text.secondary">
                Ask questions like “Show me all the documents about health insurance that are about to expire in 1 month.”
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  placeholder="Ask about your files..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void searchDocuments();
                    }
                  }}
                />
                <Button variant="contained" onClick={() => void searchDocuments()} disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </Button>
                <Button variant="outlined" onClick={() => void clearSearch()} disabled={searching && !searchQuery}>
                  Clear
                </Button>
              </Stack>
              {searchSummary && <Alert severity="info">{searchSummary}</Alert>}
            </Stack>
          </Paper>
          <NotificationPanel notifications={notifications} onRead={handleNotificationRead} />
          <UploadArea uploading={uploading} error={error} onUpload={uploadFile} />
          <DocumentList documents={documents} />

          <Tooltip title="View Source Code" arrow>
            <Fab
              aria-label="github"
              sx={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                bgcolor: '#000000',
                color: '#ffffff',
                '&:hover': {
                  bgcolor: '#333333',
                },
              }}
              href="https://github.com/Vanndavid/AiCompliance"
              target="_blank"
            >
              <GitHubIcon />
            </Fab>
          </Tooltip>
        </Container>
      ) : (
        <Container>
          <LandingPage />
        </Container>
      )}
    </Box>
  );
}
