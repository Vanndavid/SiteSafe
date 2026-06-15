import { useState } from 'react';
import { Button, keyframes, Stack } from '@mui/material';
import { useAuth } from '../auth/AuthContext';

type AutoLoginButtonProps = {
  disablePulse?: boolean;
};

export const AutoLoginButton = ({ disablePulse = false }: AutoLoginButtonProps) => {
  const { demoLogin, isDemoEnabled } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDemoEnabled) {
    return null;
  }

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await demoLogin();
    } catch (err) {
      console.error('Demo login failed:', err);
      setError('Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const pulse = keyframes`
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.02); opacity: 0.8; color: #cfe5f1; }
    100% { transform: scale(1); opacity: 1; }
  `;

  return (
    <Stack spacing={1} alignItems="center">
      <Button
        onClick={() => void handleGuestLogin()}
        disabled={isLoading}
        variant={disablePulse ? 'contained' : 'text'}
        sx={{
          px: 4,
          py: 1.5,
          fontWeight: 600,
          color: 'white',
          animation: !isLoading && !disablePulse ? `${pulse} 1.5s ease-in-out infinite` : 'none',
          '&:hover': {
            animation: 'none',
          },
        }}
      >
        {isLoading ? 'Logging in…' : 'TRY DEMO'}
      </Button>
      {error && (
        <Button size="small" color="inherit" disabled sx={{ color: '#fecaca', textTransform: 'none' }}>
          {error}
        </Button>
      )}
    </Stack>
  );
};
