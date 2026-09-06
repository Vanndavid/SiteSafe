import { useState } from 'react';
import { AppBar, Button, Stack, Toolbar, Typography } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../auth/AuthContext';
import { AutoLoginButton } from './AutoLoginButton';
import { AuthDialog } from './AuthDialog';

export const Header = () => {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: '#0F172A' }}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Ai Compliance
          </Typography>

          {!isLoading && !isAuthenticated && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button color="inherit" onClick={() => setAuthDialogOpen(true)}>
                Sign In
              </Button>
              <AutoLoginButton />
            </Stack>
          )}

          {!isLoading && isAuthenticated && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {user?.name || user?.email}
              </Typography>
              <Button color="inherit" onClick={() => void logout()}>
                Log out
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <AuthDialog open={authDialogOpen} onClose={() => setAuthDialogOpen(false)} />
    </>
  );
};
