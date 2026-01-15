import { useEffect, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Header } from './components/Header';
import { UploadArea } from './components/UploadArea';
import { DocumentList } from './components/DocumentList';
import { NotificationPanel } from './components/NotificationPanel';
import { api } from './api/client';
import type { DocumentItem, NotificationItem } from './types';

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  useEffect(() => {
    fetchDocuments();
    fetchNotifications();
  }, []);

  const fetchDocuments = async () => {
    const res = await api.get('api/documents');
    setDocuments(res.data);
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('api/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };
  const pollForStatus = (docId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`api/document/${docId}`);
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
    }, 2000);
  };

  const handleNotificationRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n._id !== id));
  };
  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    console.log('Uploading file:', file);
    try {
      const formData = new FormData();
      formData.append('document', file);

      const res = await api.post('/api/upload', formData,{
        headers: {
          'Content-Type': undefined,
        },
      });

      const data = res.data;
      setDocuments(prev => [
        { id: data.file.id, name: data.file.originalName, status: 'pending' },
        ...prev
      ]);
      pollForStatus(data.file.id);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box minHeight="100vh" bgcolor="#f5f5f5">
      <Header />
      <Container maxWidth="md" sx={{ mt: 6 }}>
        <Typography variant="h3" textAlign="center" fontWeight="bold" mb={4}>
          AI Compliance Officer
        </Typography>
        <NotificationPanel notifications={notifications} onRead={handleNotificationRead} />
        <UploadArea uploading={uploading} error={error} onUpload={uploadFile} />
        <DocumentList documents={documents} />
      </Container>
    </Box>
  );
}
