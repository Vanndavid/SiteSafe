import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

export const Header = () => {
  return (
    <AppBar position="static" sx={{ backgroundColor: '#0F172A' }}>
      <Toolbar>
        <SecurityIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          Ai Compliance
        </Typography>
        {/* <Button color="inherit">Login</Button> */}
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </Toolbar>
    </AppBar>
  );
};