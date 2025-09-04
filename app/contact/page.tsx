"use client";

import { Mail, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contact & Support</h1>
        <p className="text-gray-600 mt-2">
          Get help, report issues, or share your suggestions to improve AI Playcaller
        </p>
      </div>

      {/* Direct Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Direct Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-700">
              Having problems? Reach out to us directly at{" "}
              <a 
                href="mailto:justin@american-football-academy.com"
                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                justin@american-football-academy.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Problem Reporting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Report a Problem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-700">
              Encountered an issue or bug? Help us fix it by reporting the problem with details about what you experienced.
            </p>
            <Button 
              asChild
              className="bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            >
              <a 
                href="https://docs.google.com/forms/d/e/1FAIpQLSc0XRzHClKkb7rUlYGSezYvI7j22F93CJqQC0kWXcxZ65NyCw/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Report a Problem
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6" />
            Share Your Ideas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-700">
              Have a suggestion for improvement? Whether it's a new play, concept, formation, feature, or any other enhancement, we'd love to hear from you!
            </p>
            <Button 
              asChild
              className="bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
            >
              <a 
                href="https://docs.google.com/forms/d/e/1FAIpQLSfPGmqy4gXs60sp_QT7wUqOEv8SVhIBBtTUEGL4-OrrqBeiuw/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Lightbulb className="h-4 w-4" />
                Submit a Suggestion
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 