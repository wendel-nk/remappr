import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PhysicalLayoutCanvas } from './PhysicalLayoutCanvas.tsx'
import { HidUsageLabel } from './HidUsageLabel.tsx'
import { hidUsageFromPageAndId } from '@/lib/actions/hidUsages'

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
    title: 'Keyboard/PhysicalLayoutCanvas',
    component: PhysicalLayoutCanvas,
    parameters: {
        // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    },
    // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
    tags: ['autodocs'],
    // More on argTypes: https://storybook.js.org/docs/api/argtypes
    argTypes: {},
    args: {
        onPositionClicked: fn(),
    },
} satisfies Meta<typeof PhysicalLayoutCanvas>

export default meta
type Story = StoryObj<typeof meta>

const TOP = [41, ...[...'QWERTYUIOP'].map((c) => c.charCodeAt(0) - 61)]
const MIDDLE = [...[...'ASDFGHJKL'].map((c) => c.charCodeAt(0) - 61), 51]
const LOWER = [
    ...[...'ZXCVBNM'].map((c) => c.charCodeAt(0) - 61),
    54,
    55,
    82,
    229,
]

const MINIVAN_POSITIONS = [
    ...TOP.map((k, i) => ({
        width: 1,
        height: 1,
        x: i,
        y: 0,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key={`top-${k}`}
                hid_usage={hidUsageFromPageAndId(7, k)}
            />,
        ],
    })),
    {
        x: TOP.length,
        y: 0,
        width: 1.75,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="backspace"
                hid_usage={hidUsageFromPageAndId(7, 42)}
            />,
        ],
    },
    {
        x: 0,
        y: 1,
        width: 1.25,
        height: 1,
        header: 'Key Press',
        children: [<span key="tab">Tab</span>],
    },
    ...MIDDLE.map((k, i) => ({
        x: i + 1.25,
        y: 1,
        width: 1,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key={`middle-${k}`}
                hid_usage={hidUsageFromPageAndId(7, k)}
            />,
        ],
    })),
    {
        x: MIDDLE.length + 1.25,
        y: 1,
        width: 1.5,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="enter"
                hid_usage={hidUsageFromPageAndId(7, 40)}
            />,
        ],
    },
    {
        x: 0,
        y: 2,
        width: 1.75,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="lshift"
                hid_usage={hidUsageFromPageAndId(7, 225)}
            />,
        ],
    },
    ...LOWER.map((k, i) => ({
        x: i + 1.75,
        y: 2,
        width: 1,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key={`lower-${k}`}
                hid_usage={hidUsageFromPageAndId(7, k)}
            />,
        ],
    })),
    {
        x: 0,
        y: 3,
        width: 1.25,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="lctrl"
                hid_usage={hidUsageFromPageAndId(7, 224)}
            />,
        ],
    },
    {
        x: 1.25,
        y: 3,
        width: 1.5,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="lgui"
                hid_usage={hidUsageFromPageAndId(7, 227)}
            />,
        ],
    },
    {
        x: 2.75,
        y: 3,
        width: 1.25,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="lalt"
                hid_usage={hidUsageFromPageAndId(7, 226)}
            />,
        ],
    },
    {
        x: 4,
        y: 3,
        width: 2.25,
        height: 1,
        header: 'Key Press',
        children: [<span key="space1"></span>],
    },
    {
        x: 6.25,
        y: 3,
        width: 2,
        height: 1,
        header: 'Key Press',
        children: [<span key="space2"></span>],
    },
    {
        x: 8.25,
        y: 3,
        width: 1.5,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="ralt"
                hid_usage={hidUsageFromPageAndId(7, 230)}
            />,
        ],
    },
    {
        x: 9.75,
        y: 3,
        width: 1,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="left"
                hid_usage={hidUsageFromPageAndId(7, 80)}
            />,
        ],
    },
    {
        x: 10.75,
        y: 3,
        width: 1,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="down"
                hid_usage={hidUsageFromPageAndId(7, 81)}
            />,
        ],
    },
    {
        x: 11.75,
        y: 3,
        width: 1,
        height: 1,
        header: 'Key Press',
        children: [
            <HidUsageLabel
                key="right"
                hid_usage={hidUsageFromPageAndId(7, 79)}
            />,
        ],
    },
]
const POSITIONS = MINIVAN_POSITIONS.map((k, i) => ({ ...k, id: `base-${i}` }))

export const Minivan: Story = {
    args: {
        positions: POSITIONS,
        hoverZoom: true,
    },
}

export const MiniMinivan: Story = {
    args: {
        positions: POSITIONS.map(({ id, x, y, width, height }) => ({
            id,
            x,
            y,
            width,
            height,
        })),
        oneU: 15,
        hoverZoom: false,
    },
}
