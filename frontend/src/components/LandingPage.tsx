import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Stack,
  Button,
} from '@mui/material';

import StorageIcon from '@mui/icons-material/Storage';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import MemoryIcon from '@mui/icons-material/Memory';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import BoltIcon from '@mui/icons-material/Bolt';
import GitHubIcon from '@mui/icons-material/GitHub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DnsIcon from '@mui/icons-material/Dns';
import DataObjectIcon from '@mui/icons-material/DataObject';
import TerminalIcon from '@mui/icons-material/Terminal';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DashboardIcon from '@mui/icons-material/Dashboard';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import BusinessIcon from '@mui/icons-material/Business';

import { AutoLoginButton } from './AutoLoginButton';

const LandingPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>

      {/* --- HERO SECTION --- */}
      <Box textAlign="center" mb={12}>
        <Chip
          icon={<VerifiedUserIcon />}
          label="Built for construction, trades & logistics teams"
          color="primary"
          variant="outlined"
          sx={{ mb: 3, fontWeight: 600 }}
        />

        <Typography
          variant="h2"
          component="h1"
          fontWeight="800"
          gutterBottom
          sx={{ letterSpacing: '-1px', fontSize: { xs: '2rem', md: '3rem' } }}
        >
          Never Miss an Expiring
          <br />
          <Box component="span" sx={{ color: '#4f46e5' }}>
            Compliance Document Again
          </Box>
        </Typography>

        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ maxWidth: 640, mx: 'auto', mb: 5, lineHeight: 1.7, fontWeight: 400 }}
        >
          AI-powered compliance tracking for licenses, certifications, and insurance
          documents. SiteSafe stores your documents, extracts expiry dates automatically,
          and alerts you before deadlines — so your team stays compliant and on site.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
          <Box width={{ xs: '100%', sm: 'auto' }}>
            <AutoLoginButton disablePulse={true} />
          </Box>
          <Button
            variant="outlined"
            size="large"
            startIcon={<GitHubIcon />}
            href="https://github.com/Vanndavid/AiCompliance"
            target="_blank"
            sx={{ px: 4, py: 1.5, textTransform: 'none', fontWeight: 600 }}
          >
            View Source Code
          </Button>
        </Stack>
      </Box>

      {/* --- PROBLEM SECTION --- */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 4, md: 5 },
          mb: 8,
          bgcolor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 4,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
          <WarningAmberIcon sx={{ color: '#dc2626' }} />
          <Typography variant="overline" fontWeight="bold" color="#991b1b" letterSpacing={1.5}>
            The Problem
          </Typography>
        </Stack>

        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
          Expired documents cost you time, money, and site access
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 720, lineHeight: 1.8 }}>
          Construction companies, trade businesses, and logistics teams manage hundreds of
          compliance documents across their workforce. When licenses, certifications, or
          insurance policies expire unnoticed, the consequences are immediate.
        </Typography>

        <Grid container spacing={3}>
          {[
            { title: 'Compliance breaches', desc: 'Regulatory violations and audit failures when credentials lapse.' },
            { title: 'Site access blocked', desc: 'Workers turned away from job sites with expired certifications.' },
            { title: 'Project delays', desc: 'Work stoppages while documents are renewed and re-verified.' },
            { title: 'Fines & penalties', desc: 'Financial penalties from missed renewal deadlines.' },
          ].map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.title}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <WarningAmberIcon sx={{ color: '#dc2626', mt: 0.3, fontSize: 20 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                    {item.desc}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* --- SOLUTION / VALUE PROP --- */}
      <Box textAlign="center" mb={8}>
        <Typography variant="overline" color="primary" fontWeight="bold" letterSpacing={1.5}>
          The Solution
        </Typography>
        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mt: 1, fontSize: { xs: '1.5rem', md: '2rem' } }}>
          SiteSafe keeps your workforce compliant — automatically
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto', lineHeight: 1.8 }}>
          Upload your documents once. SiteSafe extracts key information using AI, tracks
          expiry dates, monitors compliance status across your team, and sends alerts before
          anything expires.
        </Typography>
      </Box>

      {/* --- FEATURE SECTIONS --- */}
      <Grid container spacing={4} mb={10}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FeatureCard
            icon={<UploadFileIcon sx={{ color: '#4f46e5' }} />}
            title="Upload Documents"
            desc="Upload licenses, certifications, and insurance documents in seconds. Support for PDF and common document formats — no manual data entry required."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FeatureCard
            icon={<AutoAwesomeIcon sx={{ color: '#8e24aa' }} />}
            title="AI Extraction"
            desc="Automatically extract key information and expiry dates from every document. AI reads your files so your team doesn't have to."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FeatureCard
            icon={<DashboardIcon sx={{ color: '#0891b2' }} />}
            title="Compliance Dashboard"
            desc="Track document status across your entire workforce in one place. See what's valid, expiring soon, or already expired at a glance."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FeatureCard
            icon={<NotificationsActiveIcon sx={{ color: '#ea580c' }} />}
            title="Expiry Monitoring"
            desc="Receive alerts before documents expire — 30 days out and counting. Never be surprised by a lapsed certification again."
          />
        </Grid>
      </Grid>

      {/* --- WORKFLOW SECTION --- */}
      <Paper
        elevation={0}
        sx={{ p: { xs: 4, md: 5 }, mb: 10, bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 4 }}
      >
        <Box textAlign="center" mb={5}>
          <Typography variant="overline" color="primary" fontWeight="bold" letterSpacing={1.5}>
            How It Works
          </Typography>
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
            From upload to alert in five simple steps
          </Typography>
          <Typography variant="body2" color="text.secondary">
            A straightforward workflow designed for compliance managers and operations teams.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={0}
          alignItems="center"
          justifyContent="center"
        >
          {[
            { icon: <UploadFileIcon />, label: 'Upload Document', color: '#4f46e5' },
            { icon: <AutoAwesomeIcon />, label: 'AI Extraction', color: '#8e24aa' },
            { icon: <MemoryIcon />, label: 'Expiry Tracking', color: '#0891b2' },
            { icon: <DashboardIcon />, label: 'Compliance Dashboard', color: '#059669' },
            { icon: <NotificationsActiveIcon />, label: 'Alerts & Monitoring', color: '#ea580c' },
          ].map((step, index, arr) => (
            <React.Fragment key={step.label}>
              <WorkflowStep icon={step.icon} label={step.label} color={step.color} />
              {index < arr.length - 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: { xs: 0, md: 1 },
                    py: { xs: 1, md: 0 },
                  }}
                >
                  <ArrowForwardIcon
                    sx={{
                      color: '#cbd5e1',
                      display: { xs: 'none', md: 'block' },
                    }}
                  />
                  <ArrowDownwardIcon
                    sx={{
                      color: '#cbd5e1',
                      display: { xs: 'block', md: 'none' },
                    }}
                  />
                </Box>
              )}
            </React.Fragment>
          ))}
        </Stack>
      </Paper>

      {/* --- KEY BENEFITS --- */}
      <Box mb={10}>
        <Box textAlign="center" mb={5}>
          <Typography variant="overline" color="primary" fontWeight="bold" letterSpacing={1.5}>
            Key Benefits
          </Typography>
          <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
            Why teams choose SiteSafe
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {[
            {
              icon: <CheckCircleOutlineIcon sx={{ color: '#059669' }} />,
              title: 'Reduce compliance risk',
              desc: 'Proactive monitoring means fewer surprises during audits and site inspections.',
            },
            {
              icon: <BusinessIcon sx={{ color: '#4f46e5' }} />,
              title: 'Built for field teams',
              desc: 'Designed for construction, trades, and logistics — industries where document compliance is non-negotiable.',
            },
            {
              icon: <VerifiedUserIcon sx={{ color: '#0891b2' }} />,
              title: 'Secure document storage',
              desc: 'Documents are encrypted and stored securely. Access controls keep sensitive credentials protected.',
            },
          ].map((benefit) => (
            <Grid size={{ xs: 12, md: 4 }} key={benefit.title}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  height: '100%',
                  border: '1px solid #e2e8f0',
                  borderRadius: 3,
                  bgcolor: '#f8fafc',
                }}
              >
                <Box sx={{ mb: 2 }}>{benefit.icon}</Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {benefit.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                  {benefit.desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* --- ARCHITECTURE SECTION (Lower Priority) --- */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 6, bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 4 }}>
        <Box textAlign="center" mb={5}>
          <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={1.5}>
            Under the Hood
          </Typography>
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
            How the Platform Works
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
            A reliable, scalable pipeline that processes documents asynchronously and
            keeps your dashboard updated in real time.
          </Typography>
        </Box>

        <Grid container spacing={4} justifyContent="center" alignItems="center">
          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<CloudQueueIcon fontSize="large" color="primary" />}
              label="Web App"
              sub="Upload & dashboard"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 0.5 }} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <ArrowForwardIcon color="disabled" />
          </Grid>

          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<DnsIcon fontSize="large" sx={{ color: '#339933' }} />}
              label="Secure API"
              sub="Auth & validation"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 0.5 }} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <ArrowForwardIcon color="disabled" />
          </Grid>

          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<StorageIcon fontSize="large" color="info" />}
              label="Document Storage"
              sub="Encrypted files"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 0.5 }} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <ArrowForwardIcon color="disabled" />
          </Grid>

          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<BoltIcon fontSize="large" color="warning" />}
              label="Processing Queue"
              sub="Reliable job handling"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 2.5 }} />

          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<DataObjectIcon fontSize="large" sx={{ color: '#00ED64' }} />}
              label="Compliance Database"
              sub="Extracted data & status"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 0.5 }} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <ArrowBackIcon color="disabled" />
          </Grid>

          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<AutoAwesomeIcon fontSize="large" sx={{ color: '#8e24aa' }} />}
              label="AI Extraction"
              sub="Document analysis"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 0.5 }} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <ArrowBackIcon color="disabled" />
          </Grid>

          <Grid size={{ xs: 12, md: 2.5 }}>
            <DiagramNode
              icon={<MemoryIcon fontSize="large" color="error" />}
              label="Background Worker"
              sub="Async processing"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* --- INFRASTRUCTURE BADGE STRIP --- */}
      <Paper elevation={0} sx={{ py: 3, px: 4, mb: 8, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 3 }}>
        <Grid container alignItems="center" spacing={4}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" textTransform="uppercase">
              Production Ready
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 9 }}>
            <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
              <DevOpsBadge icon={<TerminalIcon fontSize="small" />} label="Dockerized" />
              <DevOpsBadge icon={<AllInclusiveIcon fontSize="small" />} label="CI/CD Pipeline" />
              <DevOpsBadge icon={<VerifiedUserIcon fontSize="small" />} label="Secure Auth" />
              <DevOpsBadge icon={<StorageIcon fontSize="small" />} label="Encrypted Storage" />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* --- BOTTOM CTA --- */}
      <Box
        textAlign="center"
        sx={{
          py: 6,
          px: 4,
          bgcolor: '#0f172a',
          borderRadius: 4,
          color: 'white',
        }}
      >
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Ready to see it in action?
        </Typography>
        <Typography variant="body1" sx={{ color: '#94a3b8', mb: 4, maxWidth: 480, mx: 'auto' }}>
          Try the live demo with pre-loaded sample documents — no signup required.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
          <Box width={{ xs: '100%', sm: 'auto' }}>
            <AutoLoginButton disablePulse={true} />
          </Box>
          <Button
            variant="outlined"
            size="large"
            startIcon={<GitHubIcon />}
            href="https://github.com/Vanndavid/AiCompliance"
            target="_blank"
            sx={{
              px: 4,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              color: 'white',
              borderColor: '#475569',
              '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            View Source Code
          </Button>
        </Stack>
      </Box>

    </Box>
  );
};

const WorkflowStep = ({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      minWidth: { xs: '100%', md: 120 },
      px: 1,
    }}
  >
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        bgcolor: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 1.5,
        color,
      }}
    >
      {icon}
    </Box>
    <Typography variant="caption" fontWeight="bold" sx={{ lineHeight: 1.4 }}>
      {label}
    </Typography>
  </Box>
);

const DiagramNode = ({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      textAlign: 'center',
      border: '1px solid #eee',
      bgcolor: '#fafafa',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s',
      '&:hover': {
        transform: 'translateY(-3px)',
        borderColor: '#94a3b8',
      },
    }}
  >
    <Box mb={1}>{icon}</Box>
    <Typography variant="subtitle2" fontWeight="bold">
      {label}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {sub}
    </Typography>
  </Paper>
);

const DevOpsBadge = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#475569' }}>
    {icon}
    <Typography variant="body2" fontWeight="600">
      {label}
    </Typography>
  </Box>
);

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      height: '100%',
      border: '1px solid #e2e8f0',
      borderRadius: 3,
      transition: 'box-shadow 0.2s, border-color 0.2s',
      '&:hover': {
        borderColor: '#94a3b8',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f1f5f9', mr: 2 }}>{icon}</Box>
      <Typography variant="h6" fontWeight="bold">
        {title}
      </Typography>
    </Box>
    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
      {desc}
    </Typography>
  </Paper>
);

export default LandingPage;
