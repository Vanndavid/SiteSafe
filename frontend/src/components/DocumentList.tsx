import { Card, CardContent, Box, Typography, List, ListItem, ListItemIcon, ListItemText, Grid, Divider, Chip } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import type { DocumentItem, AiExtraction } from '../types';

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
                <ArticleIcon sx={{ mr: 2, mt: 0.5 }} />

                {/* 👇 FULL CONTROL — NO ListItemText */}
                <Box width="100%">
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography fontWeight="bold">
                      {doc.name}
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
      </CardContent>
    </Card>
  );
};