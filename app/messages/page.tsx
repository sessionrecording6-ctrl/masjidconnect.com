import { Suspense } from "react";
import { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MessagesView } from "@/components/messages/messages-view";

export const metadata: Metadata = {
  title: "Messages | MosqueConnect",
  description: "Private messaging with community members",
};

export default function MessagesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-6 text-2xl font-bold">Messages</h1>
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading messages...</div>}>
            <MessagesView />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
