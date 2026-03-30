"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquarePlus,
  Send,
  ImagePlus,
  MoreVertical,
  Search,
  Users,
  User,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  X,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";

interface Conversation {
  id: string;
  name: string | null;
  type: "direct" | "group" | "broadcast";
  image_url: string | null;
  role: string;
  is_muted: boolean;
  last_message: {
    id: string;
    content: string;
    message_type: string;
    created_at: string;
    sender_id: string;
    profiles: { full_name: string };
  } | null;
  unread_count: number;
  participants: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  }[];
}

interface Message {
  id: string;
  content: string | null;
  message_type: string;
  image_url: string | null;
  created_at: string;
  sender_id: string;
  is_edited: boolean;
  sender: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  reply_to?: {
    id: string;
    content: string;
    sender: { full_name: string };
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

export function MessagesView() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchUsers, setSearchUsers] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [conversationType, setConversationType] = useState<"direct" | "group" | "broadcast">("direct");
  const [groupName, setGroupName] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      
      if (data.conversations) {
        setConversations(data.conversations);
        return data.conversations;
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
    return [];
  }, [user]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      const data = await res.json();
      
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Set up realtime subscriptions
  useEffect(() => {
    const init = async () => {
      const convos = await fetchConversations();
      
      // Handle URL userId routing for direct messages
      const urlUserId = searchParams.get('userId');
      if (urlUserId && user && convos) {
        // Find existing conversation with this user
        const existingConvo = convos.find((c: any) => 
          c.type === 'direct' && c.participants.some((p: any) => p.id === urlUserId)
        );

        if (existingConvo) {
          handleSelectConversation(existingConvo);
        } else {
          // Check if user exists and create a conversation
          try {
            const res = await fetch("/api/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "direct",
                participant_ids: [urlUserId],
              }),
            });
            const data = await res.json();
            if (data.conversation) {
              await fetchConversations();
              handleSelectConversation(data.conversation);
            }
          } catch (e) {
            console.error("Auto-start chat failed:", e);
          }
        }
        
        // Remove param from URL
        router.replace('/messages');
      }
    };

    init();

    if (!user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload: any) => {
          const newMsg = payload.new as any;
          
          // If we have this conversation selected, add the message
          if (selectedConversation?.id === newMsg.conversation_id) {
            const { data: fullMessage } = await supabase
              .from("messages")
              .select(`*, sender:profiles!sender_id(id, full_name, avatar_url)`)
              .eq("id", newMsg.id)
              .single();

            if (fullMessage) {
              setMessages(prev => [...prev, fullMessage]);
            }
          }

          // Update conversation list
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [fetchConversations, selectedConversation, supabase, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Search users
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (!searchUsers.trim() || !user) {
        setSearchResults([]);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .neq("id", user.id)
        .or(`full_name.ilike.%${searchUsers}%,email.ilike.%${searchUsers}%`)
        .limit(10);

      setSearchResults(data || []);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchUsers, supabase, user]);

  // Handle selecting a conversation
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!selectedConversation || (!newMessage.trim() && !selectedImage)) return;

    setSending(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        const formData = new FormData();
        formData.append("file", selectedImage);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          imageUrl = url;
        }
      }

      const res = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim() || null,
          message_type: imageUrl ? "image" : "text",
          image_url: imageUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      setNewMessage("");
      clearImage();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Create new conversation
  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: conversationType,
          name: conversationType !== "direct" ? groupName : null,
          participant_ids: selectedUsers.map(u => u.id),
        }),
      });

      const data = await res.json();

      if (data.conversation) {
        setShowNewConversation(false);
        setSelectedUsers([]);
        setGroupName("");
        setConversationType("direct");
        fetchConversations();
        
        // Select the new conversation
        handleSelectConversation(data.conversation);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get conversation display name
  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === "direct") {
      const otherUser = conv.participants.find(p => p.id !== user?.id);
      return otherUser?.full_name || "Unknown";
    }
    return "Group Chat";
  };

  // Get conversation avatar
  const getConversationAvatar = (conv: Conversation) => {
    if (conv.image_url) return conv.image_url;
    if (conv.type === "direct") {
      const otherUser = conv.participants.find(p => p.id !== user?.id);
      return otherUser?.avatar_url || null;
    }
    return null;
  };

  // Format message date
  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return "Yesterday " + format(date, "h:mm a");
    return format(date, "MMM d, h:mm a");
  };

  if (!user) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-lg border bg-card">
      {/* Conversations List */}
      <div className={cn(
        "w-full border-r md:w-80",
        selectedConversation && "hidden md:block"
      )}>
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New Conversation</DialogTitle>
                <DialogDescription>
                  Start a new conversation with community members
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Button
                    variant={conversationType === "direct" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConversationType("direct")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Direct
                  </Button>
                  <Button
                    variant={conversationType === "group" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConversationType("group")}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Group
                  </Button>
                  <Button
                    variant={conversationType === "broadcast" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConversationType("broadcast")}
                  >
                    <Megaphone className="mr-2 h-4 w-4" />
                    Broadcast
                  </Button>
                </div>

                {conversationType !== "direct" && (
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Enter group name"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Search Users</Label>
                  <Input
                    value={searchUsers}
                    onChange={(e) => setSearchUsers(e.target.value)}
                    placeholder="Search by name or email"
                  />
                </div>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <Badge key={u.id} variant="secondary">
                        {u.full_name}
                        <button
                          onClick={() => setSelectedUsers(prev => prev.filter(p => p.id !== u.id))}
                          className="ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          if (conversationType === "direct") {
                            setSelectedUsers([result]);
                          } else {
                            if (!selectedUsers.find(u => u.id === result.id)) {
                              setSelectedUsers(prev => [...prev, result]);
                            }
                          }
                          setSearchUsers("");
                        }}
                        className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={result.avatar_url || ""} />
                          <AvatarFallback>{result.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="text-sm font-medium">{result.full_name}</p>
                          <p className="text-xs text-muted-foreground">{result.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateConversation}
                  disabled={selectedUsers.length === 0 || (conversationType !== "direct" && !groupName.trim())}
                >
                  Start Conversation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[calc(100%-65px)]">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquarePlus className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No conversations yet</p>
              <Button
                variant="link"
                onClick={() => setShowNewConversation(true)}
              >
                Start a conversation
              </Button>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "flex w-full items-center gap-3 p-4 hover:bg-muted",
                  selectedConversation?.id === conv.id && "bg-muted"
                )}
              >
                <div className="relative">
                  <Avatar>
                    <AvatarImage src={getConversationAvatar(conv) || ""} />
                    <AvatarFallback>
                      {conv.type === "direct" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {conv.unread_count > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden text-left">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-medium">{getConversationName(conv)}</p>
                    {conv.last_message && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="truncate text-sm text-muted-foreground">
                      {conv.last_message.message_type === "image" ? "Sent an image" : conv.last_message.content}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex flex-1 flex-col",
        !selectedConversation && "hidden md:flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b p-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar>
                <AvatarImage src={getConversationAvatar(selectedConversation) || ""} />
                <AvatarFallback>
                  {selectedConversation.type === "direct" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{getConversationName(selectedConversation)}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.type === "direct"
                    ? "Direct message"
                    : `${selectedConversation.participants.length} participants`}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Details</DropdownMenuItem>
                  <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground">Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => {
                    const isOwn = msg.sender_id === user?.id;
                    const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;

                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-3", isOwn && "flex-row-reverse")}
                      >
                        {showAvatar ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.sender?.avatar_url || ""} />
                            <AvatarFallback>{msg.sender?.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                        <div className={cn("max-w-[70%]", isOwn && "items-end")}>
                          {showAvatar && !isOwn && (
                            <p className="mb-1 text-xs text-muted-foreground">{msg.sender?.full_name}</p>
                          )}
                          <div
                            className={cn(
                              "rounded-lg p-3",
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}
                          >
                            {msg.image_url && (
                              <div className="mb-2 overflow-hidden rounded">
                                <Image
                                  src={msg.image_url}
                                  alt="Message image"
                                  width={250}
                                  height={250}
                                  className="object-cover"
                                />
                              </div>
                            )}
                            {msg.content && <p className="text-sm">{msg.content}</p>}
                          </div>
                          <p className={cn("mt-1 text-xs text-muted-foreground", isOwn && "text-right")}>
                            {formatMessageDate(new Date(msg.created_at))}
                            {isOwn && (
                              <CheckCheck className="ml-1 inline h-3 w-3" />
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4">
              {imagePreview && (
                <div className="relative mb-2 inline-block">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={100}
                    height={100}
                    className="rounded object-cover"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -right-2 -top-2 h-5 w-5"
                    onClick={clearImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button onClick={handleSendMessage} disabled={sending || (!newMessage.trim() && !selectedImage)}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquarePlus className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
