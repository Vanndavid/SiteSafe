import { Card, CardContent, Box, Typography, List, ListItem, Link, Grid, Divider, Chip, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import type { DocumentItem, AiExtraction } from '../types';
import { useState } from 'react';
import { api } from '../api/client';

interface Props {
  documents: DocumentItem[];
}

export const DocumentList = ({ documents }: Props) => {
  if (documents.length === 0) return null;

  const getStatusChip = (status: string, extraction?: AiExtraction) => {
    if (status === 'pending') return <Chip icon={<CircularProgress size={16} />} label="Processing" color="warning" variant="outlined" />;
    if (status === 'failed') return <Chip icon={<ErrorIcon />} label="Failed" color="error" variant="outlined" />;
    
    const isValid = extraction?.expiryDate && extraction?.licenseNumber;
    return <Chip icon={<CheckCircleIcon />} label={isValid ? "Valid" : "Review"} color={isValid ? "success" : "info"} variant="outlined" />;
  };

  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const handleOpen = (doc:DocumentItem) => setSelectedDoc(doc);
  const handleClose = () => setSelectedDoc(null)

  const handleDownload = async (e: any, doc:DocumentItem) => {
    e.preventDefault(); // Stop the <a> tag from navigating
    
    try {
      // 1. Get the temporary link from your API
      const encodedKey = encodeURIComponent(doc.storagePath);
      const response = await api.get(`/api/download/${encodedKey}`, {
        params: { name: doc.name }
      });
      const downloadUrl = response.data.url;

      // Opnen in the same window
      // 2a Create a hidden link and click it to trigger the download
      // const tempLink = document.createElement('a');
      // tempLink.href = downloadUrl;
      // tempLink.setAttribute('download', doc.name); // Secondary fallback
      // document.body.appendChild(tempLink);
      // tempLink.click();
    
      // 3. Cleanup
      // document.body.removeChild(tempLink);

      // Or Open in a new tab/window
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');

    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download file.");
    }
  };
  return (
    <Card sx={{ border: '1px solid #e0e0e0', animation: 'fadeIn 0.5s ease-in' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ArticleIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h5" fontWeight="bold">Recent Uploads</Typography>
        </Box>
        
        <List>
          {documents.map((doc, idx) => (
            <Box key={doc.id}>
              {idx > 0 && <Divider />}
              <ListItem alignItems="flex-start">
                <Tooltip title="Read Content" placement="top">
                  <Button color='secondary' disabled={!(doc.extraction?.content??false)} onClick={() => handleOpen(doc)}>
                    <ArticleIcon sx={{ mr: 2, mt: 0.5 }} />
                  </Button>
                </Tooltip>
             
                {/* 👇 FULL CONTROL — NO ListItemText */}
                <Box width="100%">
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography fontWeight="bold">
                       <Link 
                        href="#" 
                        onClick={(e) => handleDownload(e, doc)}
                      >
                        {doc.name}
                      </Link>
                    </Typography>
                    {getStatusChip(doc.status, doc.extraction)}
                  </Box>

                  {doc.status === 'processed' && doc.extraction && (
                    <Grid container spacing={2} mt={1}>
                      <Grid>
                        <Typography variant="caption">Expiry</Typography>
                        <Typography>{doc.extraction.expiryDate || 'N/A'}</Typography>
                      </Grid>
                      <Grid>
                        <Typography variant="caption">Number</Typography>
                        <Typography>{doc.extraction.licenseNumber || 'N/A'}</Typography>
                      </Grid>
                      <Grid>
                        <Typography variant="caption">Holder</Typography>
                        <Typography>{doc.extraction.holderName || 'N/A'}</Typography>
                      </Grid>
                      <Grid>
                        <Typography variant="caption">Type</Typography>
                        <Typography>{doc.extraction.docType || 'N/A'}</Typography>
                      </Grid>
                       <Grid>
                        <Typography variant="caption">Confident</Typography>
                        <Typography>{(doc.extraction.confidence?doc.extraction.confidence*100:0)+"%" || 'N/A'}</Typography>
                      </Grid>
                    </Grid>
                  )}

                  {doc.status === 'pending' && (
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Analyzing document…
                    </Typography>
                  )}

                  {doc.status === 'failed' && (
                    <Typography variant="body2" color="error" mt={1}>
                      Analysis failed.
                    </Typography>
                  )}
                </Box>
              </ListItem>
            </Box>
          ))}
        </List>
        <Dialog 
          open={Boolean(selectedDoc)} 
          onClose={handleClose}
        >
          <DialogTitle>{selectedDoc?.name}</DialogTitle>
          <DialogContent>
            {selectedDoc?.extraction?.content}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};