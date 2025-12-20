"use client"

import { FileDown, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface CourseContentProps {
  lesson: {
    id: string
    titleEn: string
    titleAr?: string
    descriptionEn?: string
    descriptionAr?: string
    content?: string
    contentAr?: string
    resources?: Array<{
      id: string
      title: string
      url: string
      type: string
    }>
  }
}

export function CourseContent({ lesson }: CourseContentProps) {
  const description = lesson.descriptionAr || lesson.descriptionEn
  const content = lesson.contentAr || lesson.content

  return (
    <div className="space-y-6">
      {/* Lesson Title & Description */}
      <div>
        <h1 className="text-2xl font-bold mb-3">
          {lesson.titleAr || lesson.titleEn}
        </h1>
        {description && (
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>

      <Separator />

      {/* Lesson Content */}
      {content && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lesson Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      {lesson.resources && lesson.resources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lesson.resources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {resource.type === "FILE" ? (
                      <FileDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ExternalLink className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{resource.title}</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    {resource.type === "FILE" ? "Download" : "Open"}
                  </Button>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
