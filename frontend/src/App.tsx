import { useState, useRef } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button, Paper, Grid, CircularProgress, Alert, Card, CardContent } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArticleIcon from '@mui/icons-material/Article';

interface AiExtraction {
  type?: string;
  expiryDate?: string;
  licenseNumber?: string;
  name?: string;
  confidence?: number;
}

function App() {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<AiExtraction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setUploadSuccess(null);
    setExtraction(null);

    const formData = new FormData();
    formData.append('document', file);

    try {
      // Note: Ensure this URL matches your backend port (3000)
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('Upload success:', data);
      
      setUploadSuccess(`Uploaded: ${data.file.originalName}`);
      
      if (data.extraction) {
        setExtraction(data.extraction);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to upload document. Is the backend running?');
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <AppBar position="static" sx={{ backgroundColor: '#0F172A' }}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            TradeComply
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="md" sx={{ mt: 8, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" color="text.primary">
            AI Compliance Officer
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Upload your licenses, insurance, or certifications. 
            <br />
            Our Gemini AI extracts the data and ensures you are site-ready.
          </Typography>
        </Box>

        {/* Upload Area */}
        <Paper elevation={3} sx={{ p: 6, textAlign: 'center', border: '2px dashed #ccc', borderRadius: 4, mb: 4 }}>
          
          {/* Hidden Input */}
          <input 
            type="file" 
            hidden 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,application/pdf"
          />

          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6">Analyzing Document...</Typography>
              <Typography variant="body2" color="text.secondary">Gemini Vision is reading your file</Typography>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Drag and drop your document here
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Supports JPG, PNG, PDF
              </Typography>
              <Button 
                variant="contained" 
                size="large" 
                onClick={handleButtonClick}
                startIcon={<CloudUploadIcon />}
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem', bgcolor: '#0F172A' }}
              >
                Select File
              </Button>
            </>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Paper>

        {/* AI Results Section */}
        {uploadSuccess && (
          <Box sx={{ animation: 'fadeIn 0.5s ease-in' }}>
            <Alert severity="success" sx={{ mb: 4 }} icon={<CheckCircleIcon fontSize="inherit" />}>
              {uploadSuccess}
            </Alert>

            {extraction && (
              <Card sx={{ border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ArticleIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h5" fontWeight="bold">
                      Extracted Data
                    </Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Document Type</Typography>
                      <Typography variant="body1" fontWeight="medium">{extraction.type || 'Unknown'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Expiry Date</Typography>
                      <Typography variant="body1" fontWeight="bold" color={extraction.expiryDate ? 'success.main' : 'error.main'}>
                        {extraction.expiryDate || 'Not Found'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">License Number</Typography>
                      <Typography variant="body1">{extraction.licenseNumber || 'Not Found'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Holder Name</Typography>
                      <Typography variant="body1">{extraction.name || 'Not Found'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Box>
        )}

      </Container>
    </Box>
  );
}

export default App;