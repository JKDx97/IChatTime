export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  user: User;
  userId: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string | null;
  mediaUrls: string[];
  user: User;
  userId: string;
  postId: string;
  parentId: string | null;
  repliesCount: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  actor: User;
  actorId: string;
  entityId: string | null;
  entityType: string | null;
  entityMediaUrl: string | null;
  createdAt: string;
}

export interface FollowStats {
  followers: number;
  following: number;
  isFollowing?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string | null;
  mediaUrls: string[];
  storyId: string | null;
  storyMediaUrl: string | null;
  readAt: string | null;
  deletedForAll?: boolean;
  deletedFor?: string[];
  sender: User;
  receiver: User;
  createdAt: string;
  tempId?: string;
  _delivered?: boolean;
}

export interface Flash {
  id: string;
  userId: string;
  user: User;
  videoUrl: string;
  description: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface FlashComment {
  id: string;
  flashId: string;
  userId: string;
  user: User;
  content: string | null;
  mediaUrls: string[];
  parentId: string | null;
  repliesCount: number;
  createdAt: string;
}

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  likesCount: number;
  likedByMe: boolean;
  viewed: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  user: User;
  stories: StoryItem[];
  hasUnviewed: boolean;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  sender: User;
  receiver: User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface FriendStatus {
  status: 'none' | 'sent' | 'received' | 'friends' | 'self';
  requestId: string | null;
}

export interface ConversationPreview {
  partnerId: string;
  partnerUsername: string;
  partnerDisplayName: string;
  partnerAvatarUrl: string | null;
  lastMessage: Message;
  unreadCount: number;
}
