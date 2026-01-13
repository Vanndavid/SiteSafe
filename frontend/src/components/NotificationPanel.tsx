import { Paper, Typography, List, ListItem, ListItemText } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Box } from '@mui/material';
import type { NotificationItem } from '../types';
import { api } from '../api/client';

interface Props {
  notifications: NotificationItem[];
  onRead: (id: string) => void;
}

const demoNotifications: NotificationItem[] = [
  {
    _id: 'demo-1',
    type: 'EXPIRY_WARNING',
    message: 'White Card expires in 14 days',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'demo-2',
    type: 'SYSTEM_INFO',
    message: 'Insurance document pending review',
    createdAt: new Date().toISOString(),
  },
];




export const NotificationPanel = ({ notifications, onRead }: Props) => {
  if (notifications.length === 0) return null;
  const markRead = async (id: string) => {
    await api.patch(`/api/notifications/${id}/read`);
    onRead(id);
  };
  return (
    <Paper sx={{ p: 2, mb: 4, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
      <Typography
        variant="h6"
        color="warning.dark"
        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
      >
        <ErrorIcon sx={{ mr: 1 }} /> Compliance Alerts
      </Typography>

      <List dense>
        {notifications.map((notif) => (
          <ListItem key={notif._id} 
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="mark as read"
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // ⛔ prevent row click
                  markRead(notif._id);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={notif.message}
              secondary={new Date(notif.createdAt).toLocaleTimeString()}
            />
          </ListItem>
        ))}
      </List>

      {notifications.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Demo data shown
        </Typography>
      )}
    </Paper>
  );
};
