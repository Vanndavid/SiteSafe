import { useRef } from 'react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface Props {
  onUpload: (file: File) => void;
  uploading: boolean;
  disabled?: boolean;
}

export const CompactUploadButton = ({ onUpload, uploading, disabled }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
      />
      <Tooltip title="Supports JPG, PNG, PDF">
        <span>
          <Button
            variant="contained"
            size="small"
            onClick={handleButtonClick}
            disabled={disabled || uploading}
            startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
            sx={{ bgcolor: '#0F172A', whiteSpace: 'nowrap' }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </span>
      </Tooltip>
    </>
  );
};
