# NanoAgent Remotion Templates

A Remotion video template project for generating videos with local Pexels stock photo or video assets and NanoAgent workflow support.

This repository contains a working Remotion demo composition called `PexelsAssetDemo`. It can download a photo or stock video from Pexels, save it locally, generate Remotion props, and render a video using those props.

## What This Repo Has

* Remotion video project
* React-based video composition
* Tailwind CSS v4 support
* Pexels media download script
* Local stock asset workflow
* Remotion props generation
* Demo render command
* NanoAgent Remotion skills and commands
* TypeScript, ESLint, and Prettier setup

## Main Demo

The main composition is:

```text
PexelsAssetDemo
```

Video settings:

```text
Width: 1280
Height: 720
FPS: 30
Duration: 120 frames
Output: out/pexels-demo.mp4
```

The demo video shows:

* A background photo or stock video from Pexels
* Animated title text
* Animated subtitle text
* Pexels attribution
* Fallback gradient background when no media is provided

## Requirements

Install these before using the project:

* Node.js
* npm
* Git
* Pexels API key

## Setup

Clone the repo:

```bash
git clone https://github.com/rizwan3d/NanoAgent-Remotion-Templates.git
cd NanoAgent-Remotion-Templates
```

Install dependencies:

```bash
npm install
```

Create your `.env` file:

```bash
cp .env.example .env
```

Add your Pexels API key inside `.env`:

```env
PEXELS_API_KEY=your_pexels_api_key_here
```

## How to Use

### 1. Start Remotion Studio

Use this command to preview the video:

```bash
npm run dev
```

This opens Remotion Studio.

### 2. Start NanoAgent

install and run NanoAgnet and start prompting. 

### 3. Save a Pexels asset

Photo example:

```bash
npm run assets:pexels -- --query "modern business team office" --orientation landscape
```

Video example:

```bash
npm run assets:pexels -- --media video --query "team meeting office" --orientation landscape --size medium
```

Then render the demo:

```bash
npm run render:pexels-demo
```

## Update Remotion

The repo includes a NanoAgent command for updating Remotion.

```bash
/update-remotion
```

Or manually:

```bash
npx remotion upgrade
npm install
```
