import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  Link,
  List,
  ListItem,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import type { AiExtraction, DocumentItem, ProjectItem } from '../types';
import { useState } from 'react';
import { api } from '../api/client';
import { CompactUploadButton } from './CompactUploadButton';

const CREATE_PROJECT_VALUE = '__create__';

interface Props {
  documents: DocumentItem[];
  projects: ProjectItem[];
  selectedProjectId: number | null;
  onProjectChange: (projectId: number | null) => void;
  onCreateProject: (name: string) => Promise<void>;
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadError: string | null;
}

export const DocumentList = ({
  documents,
  projects,
  selectedProjectId,
  onProjectChange,
  onCreateProject,
  onUpload,
  uploading,
  uploadError,
}: Props) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const getStatusChip = (status: string, extraction?: AiExtraction) => {
    if (status === 'pending') {
      return <Chip icon={<CircularProgress size={16} />} label="Processing" color="warning" variant="outlined" />;
    }
    if (status === 'failed') {
      return <Chip icon={<ErrorIcon />} label="Failed" color="error" variant="outlined" />;
    }

    const isValid = extraction?.expiryDate && extraction?.licenseNumber;
    return (
      <Chip
        icon={<CheckCircleIcon />}
        label={isValid ? 'Valid' : 'Review'}
        color={isValid ? 'success' : 'info'}
        variant="outlined"
      />
    );
  };

  const handleOpen = (doc: DocumentItem) => setSelectedDoc(doc);
  const handleClose = () => setSelectedDoc(null);

  const handleProjectSelect = (event: SelectChangeEvent<number | string>) => {
    const value = event.target.value;
    if (value === CREATE_PROJECT_VALUE) {
      setCreateProjectError(null);
      setNewProjectName('');
      setCreateDialogOpen(true);
      return;
    }

    onProjectChange(typeof value === 'number' ? value : Number(value));
  };

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      setCreateProjectError('Project name is required');
      return;
    }

    setCreatingProject(true);
    setCreateProjectError(null);

    try {
      await onCreateProject(trimmedName);
      setCreateDialogOpen(false);
      setNewProjectName('');
    } catch {
      setCreateProjectError('Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();

    try {
      const encodedKey = encodeURIComponent(doc.storagePath);
      const response = await api.get(`/api/download/${encodedKey}`, {
        params: { name: doc.name },
      });
      const downloadUrl = response.data.url;
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file.');
    }
  };

  return (
    <Card sx={{ border: '1px solid #e0e0e0', animation: 'fadeIn 0.5s ease-in', mb: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <ArticleIcon color="primary" sx={{ mr: 1 }} />
            <FormControl size="small" sx={{ minWidth: 220, flex: 1, maxWidth: 360 }}>
              <InputLabel id="project-select-label">Project</InputLabel>
              <Select
                labelId="project-select-label"
                label="Project"
                value={selectedProjectId ?? ''}
                onChange={handleProjectSelect}
                displayEmpty
              >
                {projects.length === 0 && (
                  <MenuItem value="" disabled>
                    No projects yet
                  </MenuItem>
                )}
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <MenuItem value={CREATE_PROJECT_VALUE}>Create new project…</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <CompactUploadButton
            onUpload={onUpload}
            uploading={uploading}
            disabled={!selectedProjectId}
          />
        </Box>

        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {uploadError}
          </Alert>
        )}

        {documents.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            {selectedProjectId
              ? 'No documents in this project yet.'
              : 'Select or create a project to upload documents.'}
          </Typography>
        ) : (
          <List>
            {documents.map((doc, idx) => (
              <Box key={doc.id}>
                {idx > 0 && <Divider />}
                <ListItem alignItems="flex-start">
                  <Tooltip title="Read Content" placement="top">
                    <Button
                      color="secondary"
                      disabled={!(doc.extraction?.content ?? false)}
                      onClick={() => handleOpen(doc)}
                    >
                      <ArticleIcon sx={{ mr: 2, mt: 0.5 }} />
                    </Button>
                  </Tooltip>

                  <Box width="100%">
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="bold">
                        <Link href="#" onClick={(e) => void handleDownload(e, doc)}>
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
                          <Typography>
                            {(doc.extraction.confidence ? doc.extraction.confidence * 100 : 0) + '%' || 'N/A'}
                          </Typography>
                        </Grid>
                      </Grid>
                    )}

                    {doc.matchReasons && doc.matchReasons.length > 0 && (
                      <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                        {doc.matchReasons.map((reason) => (
                          <Chip
                            key={`${doc.id}-${reason}`}
                            label={reason}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
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
        )}

        <Dialog open={createDialogOpen} onClose={() => !creatingProject && setCreateDialogOpen(false)}>
          <DialogTitle>Create new project</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Project name"
              fullWidth
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreateProject();
                }
              }}
              error={Boolean(createProjectError)}
              helperText={createProjectError}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={creatingProject}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateProject()} variant="contained" disabled={creatingProject}>
              {creatingProject ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(selectedDoc)} onClose={handleClose}>
          <DialogTitle>{selectedDoc?.name}</DialogTitle>
          <DialogContent>{selectedDoc?.extraction?.content}</DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
