import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import { api } from '../api/client';
import type { AskResponse } from '../types';

const EXAMPLE_QUESTIONS = [
  'When does the public liability cover expire?',
  'What conditions are on the forklift licence?',
  'What is the maximum wind speed for crane lifts?',
];

interface Props {
  selectedProjectId: number | null;
}

export const AskDocuments = ({ selectedProjectId }: Props) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (asked: string) => {
    const trimmed = asked.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await api.post<AskResponse>('/api/ask', {
        question: trimmed,
        ...(selectedProjectId != null ? { projectId: selectedProjectId } : {}),
      });
      setAnswer(response.data);
    } catch {
      setError('Could not answer that question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Ask your documents
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Answers come only from documents you have uploaded, with a link back to the source.
      </Typography>

      <Box
        component="form"
        onSubmit={event => {
          event.preventDefault();
          void submit(question);
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            size="small"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="e.g. When does Jordan Mercer's white card expire?"
            disabled={loading}
            inputProps={{ maxLength: 500 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !question.trim()}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
            sx={{ minWidth: 120 }}
          >
            {loading ? 'Asking' : 'Ask'}
          </Button>
        </Stack>
      </Box>

      {!answer && !loading && (
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
          {EXAMPLE_QUESTIONS.map(example => (
            <Chip
              key={example}
              label={example}
              size="small"
              variant="outlined"
              onClick={() => {
                setQuestion(example);
                void submit(example);
              }}
            />
          ))}
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {answer && (
        <Box sx={{ mt: 3 }}>
          {/* A not-found response is styled as information, not failure: declining
              to answer is the correct outcome when the documents are silent. */}
          <Alert severity={answer.answered ? 'success' : 'info'} icon={false}>
            <Typography variant="body1">{answer.answer}</Typography>
          </Alert>

          {answer.citations.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Sources
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {answer.citations.map(citation => (
                  <Stack
                    key={citation.chunkId}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <DescriptionIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {citation.documentName}
                    </Typography>
                    <Chip label={`page ${citation.pageNumber}`} size="small" variant="outlined" />
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};
