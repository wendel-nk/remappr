// pattern-check: skip — presentational dedup, no abstraction
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/ui/card'

interface FeatureCardProps {
    title: string
    description: string
    action: ReactNode
}

export function FeatureCard({
    title,
    description,
    action,
}: FeatureCardProps): JSX.Element {
    return (
        <Card className="border-dashed">
            <CardContent className="flex h-full flex-col items-center justify-between gap-4 py-8 text-center">
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                {action}
            </CardContent>
        </Card>
    )
}
