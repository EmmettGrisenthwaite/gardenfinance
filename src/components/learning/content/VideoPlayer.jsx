import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play } from "lucide-react";

export default function VideoPlayer({ title, url, description }) {
  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Play className="w-6 h-6 text-red-600" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-gray-600 text-sm mt-2">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="aspect-video w-full">
          <iframe
            src={url}
            className="w-full h-full rounded-b-2xl"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
      </CardContent>
    </Card>
  );
}