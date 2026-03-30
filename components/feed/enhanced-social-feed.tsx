'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Image as ImageIcon, 
  Loader2, 
  Search, 
  Users, 
  UserCheck,
  Send,
  X,
  MoreHorizontal,
  Trash2,
  Bookmark,
  Calendar,
  HandHeart,
  Quote,
  Megaphone,
  CheckCircle,
  BookOpen,
  Building2,
  User,
  Shield,
  MapPin,
  ImagePlus,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('Failed to fetch')
    throw error
  }
  return res.json()
}

function PostSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}

function UserCard({ user: member, isOnline = false, onMessage }: { user: any; isOnline?: boolean; onMessage: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar_url} alt={member.full_name} />
          <AvatarFallback>{member.full_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${member.id}`} className="font-medium text-sm hover:underline truncate block">
          {member.full_name || 'Anonymous'}
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          {member.profession || member.role || 'Member'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isOnline && (
          <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">Online</Badge>
        )}
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onMessage(member.id)}
          title={`Message ${member.full_name}`}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function PostCard({ 
  post, 
  user,
  isLiked,
  isBookmarked,
  onMutateFeed 
}: { 
  post: any, 
  user: any,
  isLiked: boolean,
  isBookmarked: boolean,
  onMutateFeed: () => void 
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const isOwner = post.author_id === user?.id
  const [localLiked, setLocalLiked] = useState(isLiked)
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count)
  const [localBookmarked, setLocalBookmarked] = useState(isBookmarked)

  useEffect(() => {
    setLocalLiked(isLiked)
    setLocalLikesCount(post.likes_count)
  }, [isLiked, post.likes_count])

  useEffect(() => {
    setLocalBookmarked(isBookmarked)
  }, [isBookmarked])

  // Load comments
  const loadComments = useCallback(async () => {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select(`*, profiles:author_id(id, full_name, avatar_url)`)
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error("Error loading comments:", error)
    } finally {
      setLoadingComments(false)
    }
  }, [post.id, supabase])

  const toggleComments = () => {
    if (!showComments && comments.length === 0 && post.comments_count > 0) {
      loadComments()
    }
    setShowComments(!showComments)
  }

  // Subscribe to real-time comments when chat is open
  useEffect(() => {
    if (!showComments) return
    const channel = supabase.channel(`comments-${post.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` }, async (payload: any) => {
        const newC = payload.new as any;
        setComments((prev: any[]) => {
          if (prev.find(c => c.id === newC.id)) return prev;
          supabase.from('post_comments').select(`*, profiles:author_id(id, full_name, avatar_url)`).eq('id', newC.id).single().then(({data}: any) => {
            if (data) {
              setComments((p: any[]) => {
                if (p.find(c => c.id === data.id)) return p;
                return [...p, data];
              })
            }
          })
          return prev;
        })
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [showComments, post.id, supabase])

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return;
    }
    
    const wasLiked = localLiked;
    setLocalLiked(!wasLiked)
    setLocalLikesCount((prev: number) => wasLiked ? Math.max(0, prev - 1) : prev + 1)
    
    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
      }
      onMutateFeed()
    } catch (error) {
      toast.error('Failed to update like')
      setLocalLiked(wasLiked)
      setLocalLikesCount(post.likes_count)
    }
  }

  const handleBookmark = async () => {
    if (!user) {
      toast.error('Please sign in to save posts')
      return;
    }
    
    const wasBookmarked = localBookmarked;
    setLocalBookmarked(!wasBookmarked)
    
    try {
      const res = await fetch('/api/feed/bookmarks', {
        method: isBookmarked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id })
      })
      if (!res.ok) throw new Error('Failed to update bookmark')
      toast.success(isBookmarked ? 'Removed from saved' : 'Added to saved')
      onMutateFeed()
    } catch (error) {
      toast.error('Failed to update saved posts')
      setLocalBookmarked(wasBookmarked)
    }
  }

  const handleDeletePost = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('author_id', user.id)
      if (error) throw error
      toast.success('Post deleted')
      onMutateFeed()
    } catch (error) {
      toast.error('Failed to delete post')
    }
  }

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return
    setAddingComment(true)
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          author_id: user.id,
          content: newComment.trim(),
        })
        .select(`*, profiles:author_id(id, full_name, avatar_url)`)
        .single()

      if (error) throw error

      setComments(prev => [...prev, data])
      setNewComment('')
      onMutateFeed() // Updates comment count in main feed
    } catch (error) {
      toast.error("Failed to add comment")
    } finally {
      setAddingComment(false)
    }
  }

  const handleShare = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/feed?post=${post.id}`)
    toast.success('Link copied to clipboard!')
  }

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'quote': return <Quote className="h-4 w-4" />
      case 'announcement': return <Megaphone className="h-4 w-4" />
      case 'event': return <Calendar className="h-4 w-4" />
      case 'prayer-request': return <HandHeart className="h-4 w-4" />
      default: return null
    }
  }

  const getRoleIcon = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'imam': return <BookOpen className="h-3 w-3" />
      case 'mosque': return <Building2 className="h-3 w-3" />
      case 'shura': return <Shield className="h-3 w-3" />
      case 'admin': return <Shield className="h-3 w-3" />
      default: return null
    }
  }

  const role = post.profiles?.role?.toLowerCase()

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${post.author_id}`} className="hover:opacity-80 transition-opacity">
              <Avatar className="h-11 w-11">
                <AvatarImage src={post.profiles?.avatar_url} alt={post.profiles?.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {post.profiles?.full_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/profile/${post.author_id}`} className="font-semibold text-sm hover:underline">
                  {post.profiles?.full_name || 'Anonymous'}
                </Link>
                {post.profiles?.is_verified && (
                  <CheckCircle className="h-4 w-4 text-primary fill-primary/20" />
                )}
                {role && role !== 'member' && role !== 'user' && (
                  <Badge variant="secondary" className="text-xs gap-1 capitalize">
                    {getRoleIcon(role)}
                    {role}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{post.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                {post.category && post.category !== 'general' && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{post.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBookmark}>
                <Bookmark className={cn("h-4 w-4 mr-2", isBookmarked && "fill-current")} />
                {isBookmarked ? 'Remove from saved' : 'Save post'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/messages?userId=${post.author_id}`)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Message {post.profiles?.full_name?.split(' ')[0] || 'User'}
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeletePost} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete post
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-3 text-sm">
        {post.post_type && post.post_type !== 'text' && post.post_type !== 'image' && (
          <div className="mb-3">
            <Badge variant="outline" className="gap-1.5 capitalize">
              {getPostTypeIcon(post.post_type)}
              {post.post_type.replace('-', ' ')}
            </Badge>
          </div>
        )}

        <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>

        {post.metadata && post.metadata.eventDetails && (
          <div className="mt-3 rounded-lg border bg-muted/50 p-3">
            <h4 className="font-semibold text-sm">{post.metadata.eventDetails.title}</h4>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                {new Date(post.metadata.eventDetails.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {post.metadata.eventDetails.location}
              </span>
            </div>
          </div>
        )}

        {post.metadata && post.metadata.quoteSource && (
          <p className="mt-2 text-xs text-muted-foreground italic">
            — {post.metadata.quoteSource}
          </p>
        )}

        {post.image_url && (
          <div className="mt-3 rounded-lg overflow-hidden relative w-full aspect-video">
            <Image 
              src={post.image_url} 
              alt="Post attachment" 
              fill
              className="object-cover"
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col pt-0 pb-3">
        {/* Stats */}
        <div className="flex items-center justify-between w-full py-2 border-y border-border/50 text-xs text-muted-foreground mb-2">
          <span>{localLikesCount || 0} likes</span>
          <span>{post.comments_count || 0} comments</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between w-full h-9">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("gap-2 h-full flex-1", localLiked && "text-rose-500")}
            onClick={handleLike}
          >
            <Heart className={cn("h-4 w-4", localLiked && "fill-current")} />
            Like
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 h-full flex-1"
            onClick={toggleComments}
          >
            <MessageCircle className="h-4 w-4" />
            Comment
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 h-full flex-1"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("gap-2 h-full flex-1", localBookmarked && "text-primary")}
            onClick={handleBookmark}
          >
            <Bookmark className={cn("h-4 w-4", localBookmarked && "fill-current")} />
            Save
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="w-full mt-3 pt-3 border-t border-border/50 space-y-3">
            {/* Add Comment */}
            {user && (
              <div className="flex gap-2 items-start">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user.user_metadata?.avatar_url || ""} />
                  <AvatarFallback>{user.email?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[40px] h-[40px] py-2 resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addingComment}
                  >
                    {addingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Comments List */}
            {loadingComments ? (
              <div className="flex justify-center py-4 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : comments.length > 0 ? (
              <div className="space-y-3 mt-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Link href={`/profile/${comment.author_id}`}>
                      <Avatar className="h-8 w-8 hover:opacity-80 transition-opacity">
                        <AvatarImage src={comment.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          {comment.profiles?.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Link href={`/profile/${comment.author_id}`} className="font-semibold text-xs hover:underline">
                          {comment.profiles?.full_name || "Anonymous"}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground py-2">No comments yet. Be the first!</p>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

export function EnhancedSocialFeed() {
  const { user, profile } = useAuth()
  const router = useRouter()
  
  // Create Post States
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImage, setNewPostImage] = useState<string | null>(null)
  const [newPostFile, setNewPostFile] = useState<File | null>(null)
  const [newPostType, setNewPostType] = useState('text')
  const [newPostCategory, setNewPostCategory] = useState('general')
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [quoteSource, setQuoteSource] = useState('')

  const [isPosting, setIsPosting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'feed' | 'online' | 'members'>('feed')
  const [activeFilter, setActiveFilter] = useState('all') // all, islamic, community, saved

  // Fetch feed posts with SWR for auto-refresh
  const { data: feedData, mutate: mutateFeed, isLoading: feedLoading, error: feedError } = useSWR(
    user ? '/api/feed/posts?limit=30&offset=0' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      refreshInterval: 15000,
    }
  )

  // Real-time synchronization
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('feed-updates-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => { mutateFeed() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => { mutateFeed() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, () => { mutateFeed() })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [mutateFeed])

  const { data: onlineUsersData } = useSWR(
    user ? '/api/users/online' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      refreshInterval: 30000,
    }
  )

  const { data: membersData } = useSWR(
    user ? '/api/users/community' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      refreshInterval: 60000,
    }
  )

  const rawPosts = feedData?.data || []
  const onlineUsers = onlineUsersData?.data || []
  const members = membersData?.data || []
  const userLikes = feedData?.userLikes || []
  const userBookmarks = feedData?.userBookmarks || []

  // Derived Filtered Posts
  const filteredPosts = useMemo(() => {
    let result = [...rawPosts]
    
    if (activeFilter !== 'all') {
      if (activeFilter === 'saved') {
        result = result.filter(p => userBookmarks.includes(p.id))
      } else {
        result = result.filter(p => p.category === activeFilter || p.post_type === activeFilter)
      }
    }
    
    return result
  }, [rawPosts, activeFilter, userBookmarks])

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const query = searchQuery.toLowerCase()
    return members.filter((member: any) =>
      member.full_name?.toLowerCase().includes(query) ||
      member.profession?.toLowerCase().includes(query) ||
      member.role?.toLowerCase().includes(query)
    )
  }, [members, searchQuery])

  const handleMessageUser = (userId: string) => {
    router.push(`/messages?userId=${userId}`)
  }

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    setNewPostFile(file)
    setNewPostImage(URL.createObjectURL(file))
  }, [])

  const handlePostCreate = useCallback(async () => {
    if (!user || (!newPostContent.trim() && !newPostImage)) {
      toast.error('Please provide some content for your post')
      return
    }

    setIsPosting(true)
    try {
      let metadata: any = null
      
      if (newPostType === 'event') {
        if (!eventTitle || !eventDate || !eventLocation) {
          toast.error('Please fill all event details')
          setIsPosting(false)
          return
        }
        metadata = { eventDetails: { title: eventTitle, date: eventDate, location: eventLocation } }
      } else if (newPostType === 'quote') {
        if (!quoteSource) {
          toast.error('Please provide a source for the quote')
          setIsPosting(false)
          return
        }
        metadata = { quoteSource }
      }

      let finalImageUrl = newPostImage
      if (newPostFile) {
        const formData = new FormData()
        formData.append('file', newPostFile)
        const response = await fetch('/api/upload', {
          method: 'POST', body: formData
        })
        if (!response.ok) throw new Error('Failed to upload image')
        const { url } = await response.json()
        finalImageUrl = url
      }

      const supabase = createClient()
      const { error } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          content: newPostContent.trim(),
          image_url: finalImageUrl,
          post_type: newPostType,
          category: newPostCategory,
          metadata: metadata,
          is_published: true,
        })

      if (error) throw error

      setNewPostContent('')
      setNewPostImage(null)
      setNewPostFile(null)
      setNewPostType('text')
      setNewPostCategory('general')
      setEventTitle('')
      setEventDate('')
      setEventLocation('')
      setQuoteSource('')
      setIsCreateDialogOpen(false)
      toast.success('Post created successfully!')
      mutateFeed()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post')
    } finally {
      setIsPosting(false)
    }
  }, [user, newPostContent, newPostImage, newPostType, newPostCategory, eventTitle, eventDate, eventLocation, quoteSource, mutateFeed])

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Join the Community</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Sign in to connect with other members, share posts, and stay updated with the community.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/auth/sign-up">Create Account</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Sidebar - User Profile */}
      <aside className="hidden lg:block lg:col-span-3">
        <Card className="sticky top-20">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-4">
                <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || ""} />
                <AvatarFallback className="text-2xl">
                  {profile?.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">{profile?.full_name || 'Welcome!'}</h3>
              <p className="text-sm text-muted-foreground mb-2">{profile?.bio || 'Community Member'}</p>
              <Badge variant="secondary" className="capitalize">{profile?.role || 'member'}</Badge>
              
              <div className="w-full mt-6 pt-4 border-t space-y-2">
                <Link href="/profile" className="block">
                  <Button variant="outline" className="w-full" size="sm">View Profile</Button>
                </Link>
                <Link href="/messages" className="block">
                  <Button variant="outline" className="w-full text-primary" size="sm">Messages</Button>
                </Link>
                <Link href="/settings" className="block">
                  <Button variant="ghost" className="w-full" size="sm">Settings</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Main Feed */}
      <main className="lg:col-span-6 space-y-6">
        
        {/* Create Post Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="w-full rounded-full border border-input bg-muted/50 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  {"What's on your mind? Share with the community..."}
                </button>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-muted-foreground"
                    onClick={() => { setNewPostType('image'); setIsCreateDialogOpen(true) }}
                  >
                    <ImagePlus className="h-4 w-4 text-primary" />
                    Photo
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-muted-foreground"
                    onClick={() => { setNewPostType('event'); setIsCreateDialogOpen(true) }}
                  >
                    <Calendar className="h-4 w-4 text-amber-500" />
                    Event
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-muted-foreground"
                    onClick={() => { setNewPostType('prayer-request'); setIsCreateDialogOpen(true) }}
                  >
                    <HandHeart className="h-4 w-4 text-rose-500" />
                    Dua Request
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-muted-foreground hidden sm:inline-flex"
                    onClick={() => { setNewPostType('quote'); setIsCreateDialogOpen(true) }}
                  >
                    <Quote className="h-4 w-4 text-teal-500" />
                    Quote
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full">
            <TabsList className="w-full justify-start h-10 bg-transparent p-0">
              <TabsTrigger 
                value="all" 
                className={cn("rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
              >All</TabsTrigger>
              <TabsTrigger 
                value="islamic" 
                className={cn("rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
              >Islamic</TabsTrigger>
              <TabsTrigger 
                value="community" 
                className={cn("rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
              >Community</TabsTrigger>
              <TabsTrigger 
                value="event" 
                className={cn("rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
              >Events</TabsTrigger>
              <TabsTrigger 
                value="saved" 
                className={cn("rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5")}
              >
                <Bookmark className="h-3.5 w-3.5" /> Saved
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Posts Feed */}
        <div className="space-y-4">
          {feedLoading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : feedError ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Failed to load posts. Please try again.</p>
                <Button variant="outline" className="mt-4" onClick={() => mutateFeed()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No posts found</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {activeFilter === 'saved' 
                    ? "You haven't saved any posts yet." 
                    : "There are no posts matching this filter. Be the first to share something!"}
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-6">
                  Create Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredPosts.map((post: any) => (
              <PostCard 
                key={post.id}
                post={post}
                user={user}
                isLiked={userLikes.includes(post.id)}
                isBookmarked={userBookmarks.includes(post.id)}
                onMutateFeed={() => mutateFeed()}
              />
            ))
          )}
        </div>
      </main>

      {/* Right Sidebar - Online & Members */}
      <aside className="hidden lg:block lg:col-span-3">
        <Card className="sticky top-20">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="online" className="text-xs">
                <UserCheck className="h-3 w-3 mr-1" />
                Online ({onlineUsers.length})
              </TabsTrigger>
              <TabsTrigger value="members" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                Members ({members.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="online" className="mt-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2">
                  {onlineUsers.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No users online</p>
                  ) : (
                    onlineUsers.map((member: any) => (
                      <UserCard key={member.id} user={member} isOnline={true} onMessage={handleMessageUser} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="members" className="mt-0">
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <ScrollArea className="h-[340px]">
                <div className="p-2 pt-0">
                  {filteredMembers.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No members found</p>
                  ) : (
                    filteredMembers.map((member: any) => (
                      <UserCard 
                        key={member.id} 
                        user={member} 
                        isOnline={onlineUsers.some((u: any) => u.id === member.id)}
                        onMessage={handleMessageUser}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      </aside>

      {/* Create Post Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Post</DialogTitle>
            <DialogDescription>Share something with the community</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-medium">Type</label>
                <Select value={newPostType} onValueChange={setNewPostType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Post type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Standard Post</SelectItem>
                    <SelectItem value="image">Photo Post</SelectItem>
                    <SelectItem value="quote">Islamic Quote</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="prayer-request">Dua Request</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-xs font-medium">Category</label>
                <Select value={newPostCategory} onValueChange={setNewPostCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="islamic">Islamic</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="mosque">Mosque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic Metadata Inputs based on Type */}
            {newPostType === 'event' && (
              <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                <Input 
                  placeholder="Event Title" 
                  value={eventTitle} 
                  onChange={(e) => setEventTitle(e.target.value)} 
                />
                <div className="flex gap-2">
                  <Input 
                    type="datetime-local" 
                    value={eventDate} 
                    onChange={(e) => setEventDate(e.target.value)} 
                  />
                  <Input 
                    placeholder="Location" 
                    value={eventLocation} 
                    onChange={(e) => setEventLocation(e.target.value)} 
                  />
                </div>
              </div>
            )}

            {newPostType === 'quote' && (
              <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                <Input 
                  placeholder="Quote Source (e.g. Sahih Bukhari, Surah Al-Baqarah)" 
                  value={quoteSource} 
                  onChange={(e) => setQuoteSource(e.target.value)} 
                />
              </div>
            )}

            <Textarea
              placeholder={
                newPostType === 'prayer-request' ? "Share your prayer request..."
                : newPostType === 'quote' ? "Write the quote/verse here..."
                : newPostType === 'event' ? "Describe your event..."
                : "What's on your mind?"
              }
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="resize-none min-h-[120px]"
            />
            
            {newPostImage && (
              <div className="relative inline-block w-full h-40">
                <Image
                  src={newPostImage || ""}
                  alt="Upload preview"
                  fill
                  className="rounded-lg object-cover"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={() => setNewPostImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById('dialog-image-input')?.click()}
                  disabled={isUploading || newPostType === 'quote'}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-primary" />}
                </Button>
                <input
                  id="dialog-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePostCreate} disabled={isPosting}>
              {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
