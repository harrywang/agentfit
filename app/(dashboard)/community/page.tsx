'use client'

import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getPlugins } from '@/lib/plugins'
import { resolveLucideIcon } from '@/lib/resolve-icon'
import '@/plugins'

export default function CommunityPage() {
  const plugins = getPlugins()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Community-contributed analysis views. Click a card to explore.
        </p>
      </div>

      {plugins.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No community plugins installed</CardTitle>
            <CardDescription>
              See CONTRIBUTING.md to learn how to create and share your own analysis plugin.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => {
            const Icon = resolveLucideIcon(plugin.manifest.icon)
            return (
              <Link
                key={plugin.manifest.slug}
                href={`/community/${plugin.manifest.slug}`}
                className="group"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        v{plugin.manifest.version}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{plugin.manifest.name}</CardTitle>
                    <CardDescription>{plugin.manifest.description}</CardDescription>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">
                        by {plugin.manifest.author}
                      </span>
                      {plugin.manifest.tags?.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
