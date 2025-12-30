import { AppBar, Toolbar, Typography, Container, Box, Button, Paper, Grid } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SecurityIcon from '@mui/icons-material/Security';

function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header */}
      <AppBar position="static" sx={{ backgroundColor: '#0F172A' }}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            SiteSafe.ai
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" color="text.primary">
            AI Compliance Officer
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Upload your licenses, insurance, or certifications. 
            <br />
            Our AI extracts the data and ensures you are site-ready.
          </Typography>
        </Box>

        {/* Upload Card */}
        <Paper elevation={3} sx={{ p: 6, textAlign: 'center', border: '2px dashed #ccc', borderRadius: 4 }}>
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
            startIcon={<CloudUploadIcon />}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
          >
            Select File
          </Button>
        </Paper>

        {/* Stats Grid */}
        <Grid container spacing={4} sx={{ mt: 4 }}>
          {['Active Documents', 'Expiring Soon', 'Compliance Score'].map((title, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {index === 2 ? '98%' : index === 0 ? '12' : '2'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {title}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

      </Container>
    </Box>
  );
}

export default App;