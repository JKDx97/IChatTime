'use client';

import { Clock, Check, CheckCheck } from 'lucide-react';

export type MsgStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface Props {
  status: MsgStatus;
  size?: number;
  className?: string;
}

export function getMessageStatus(msg: {
  id: string;
  readAt: string | null;
  _delivered?: boolean;
}): MsgStatus {
  if (!msg.id) return 'sending';
  if (msg.readAt) return 'read';
  if (msg._delivered) return 'delivered';
  return 'sent';
}

export default function MessageStatus({ status, size = 14, className = '' }: Props) {
  switch (status) {
    case 'sending':
      return <Clock className={className} style={{ width: size, height: size }} />;
    case 'sent':
      return <Check className={className} style={{ width: size, height: size }} />;
    case 'delivered':
      return <CheckCheck className={className} style={{ width: size, height: size }} />;
    case 'read':
      return <CheckCheck className={`text-sky-400 ${className}`} style={{ width: size, height: size }} />;
    default:
      return null;
  }
}
