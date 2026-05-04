/* eslint-disable react-refresh/only-export-components */
import {Component, ErrorInfo, ReactNode} from 'react'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ( error: Error, reset: () => void ) => ReactNode
    onError?: ( error: Error, info: ErrorInfo ) => void
}

interface ErrorBoundaryState {
    error: Error | null
}

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = {error: null}

    static getDerivedStateFromError ( error: Error ): ErrorBoundaryState {
        return {error}
    }

    componentDidCatch ( error: Error, info: ErrorInfo ): void {
        this.props.onError?.( error, info )

        console.error( '[ErrorBoundary]', error, info.componentStack )
    }

    reset = (): void => this.setState( {error: null} )

    render (): ReactNode {
        if ( this.state.error ) {
            if ( this.props.fallback ) {
                return this.props.fallback( this.state.error, this.reset )
            }
            return (
                <DefaultFallback error={this.state.error} reset={this.reset} />
            )
        }
        return this.props.children
    }
}

function DefaultFallback ( {
    error,
    reset,
}: {
    error: Error
    reset: () => void
} ): JSX.Element {
    return (
        <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[200px]"
        >
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground max-w-md">
                {error.message || 'An unexpected error occurred.'}
            </p>
            <button
                type="button"
                onClick={reset}
                className="px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent text-sm cursor-pointer"
            >
                Try again
            </button>
        </div>
    )
}
