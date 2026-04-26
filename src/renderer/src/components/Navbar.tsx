import { Redo2, Save, Trash2, Undo2 } from 'lucide-react'

export function Navbar(): JSX.Element {
    return (
        <>
            <div className="navbar bg-base-100">
                <div className="navbar-start">
                    <img
                        src="/remappr.webp"
                        alt="Remappr Logo"
                        className="h-8 rounded"
                    />
                    {/*<p>Studio</p>*/}
                </div>
                <div className="navbar-center">
                    <div className="dropdown">
                        <button type="button" className="btn m-1">
                            Click
                        </button>
                        <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                            <li>
                                <button type="button">Disconnect</button>
                            </li>
                            <li>
                                <button type="button">
                                    Restore Stock Settings
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="navbar-end">
                    <button className="btn btn-ghost btn-circle">
                        <Undo2 aria-label="Undo" />
                    </button>
                    <button className="btn btn-ghost btn-circle">
                        <Redo2 aria-label="Redo" />
                    </button>
                    <button className="btn btn-ghost btn-circle">
                        <div className="indicator">
                            <Save
                                className="inline-block w-4 mx-1"
                                aria-label="Save"
                            />
                            <span className="badge badge-xs badge-primary indicator-item"></span>
                        </div>
                    </button>
                    <button className="btn btn-ghost btn-circle">
                        <Trash2
                            className="inline-block w-4 mx-1"
                            aria-label="Discard"
                        />
                    </button>
                </div>
            </div>
        </>
    )
}
