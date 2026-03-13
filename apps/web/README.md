# OpenGame.org

![OGS Logo](/public/og-image.png)

> Official web platform for Open Game System (OGS)

## Overview

This repository contains the source code for [OpenGame.org](https://opengame.org), the official web platform component of the Open Game System. The site provides information about the Open Game System ecosystem, documentation for developers, and resources for integrating web games with native device features.

## Features

- Responsive design built with React and TypeScript
- Component-driven architecture using shadcn/ui
- Light and dark theme support
- Fast, optimized Vite build system
- SEO-optimized content pages
- Documentation for OGS features and SDKs

## Technology Stack

- [Vite](https://vitejs.dev/) - Build tool and development server
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Lucide React](https://lucide.dev/) - Icon library

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/open-game-system/opengame-org.git
cd opengame-org

# Install dependencies
pnpm install
```

### Development

To start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:8080`.

### Building for Production

```bash
# Build the application
pnpm build

# Preview the production build locally
pnpm preview
```

## Deployment to Cloudflare

This project is deployed on Cloudflare Pages.

### Manual Deployment

To manually deploy the application to Cloudflare Pages:

1. Build the application:
   ```bash
   pnpm build
   ```

2. Deploy to Cloudflare Pages:
   ```bash
   pnpm cf:deploy
   ```

   This will prompt you to log in to Cloudflare if you haven't already and then deploy the `dist` directory to your Cloudflare Pages project.

### Automatic Deployment with GitHub

We've set up GitHub Actions to automatically deploy the application to Cloudflare Pages whenever changes are pushed to the `main` branch. The workflow does the following:

1. Checks out the code
2. Sets up Node.js and pnpm
3. Installs dependencies
4. Builds the application
5. Deploys to Cloudflare Pages

To set up automatic deployments, you need to add the following secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with Pages permissions
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

#### Creating a Cloudflare API Token

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Navigate to My Profile > API Tokens
3. Click "Create Token"
4. Use the "Edit Cloudflare Workers" template or create a custom token with the following permissions:
   - Account > Cloudflare Pages > Edit
   - Zone > Zone Settings > Read
   - Zone > Zone > Read
5. Set the Account Resources to include your account
6. Create the token and copy it for use in GitHub secrets

### Setting Up a New Cloudflare Pages Project

If you're setting up a new Cloudflare Pages project:

1. Log in to your Cloudflare dashboard
2. Go to Pages > Create a project
3. Connect to your GitHub repository or choose "Direct Upload"
4. Configure with:
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Node.js version: 18 (or higher)

5. Set up environment variables if needed (like `VITE_API_URL`)

6. Deploy!

### Custom Domain Setup

To set up a custom domain (like opengame.org):

1. In your Cloudflare Pages project, go to Custom domains
2. Add your domain and follow the instructions to set up DNS records
3. Cloudflare will automatically provision an SSL certificate

## Project Structure

```
/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/          # shadcn UI components
│   │   └── ...          # Custom components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   ├── pages/           # Application pages
│   └── App.tsx          # Main application component
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tailwind.config.ts   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Related Repositories

The OpenGame.org website is part of the Open Game System ecosystem:

- [specification](https://github.com/open-game-system/specification) - OGS specification documents
- [opengame-api](https://github.com/open-game-system/opengame-api) - API server implementation
- [auth-kit](https://github.com/open-game-system/auth-kit) - Authentication SDK
- [notification-kit](https://github.com/open-game-system/notification-kit) - Notifications SDK
- [cast-kit](https://github.com/open-game-system/cast-kit) - TV casting SDK
- [opengame-app](https://github.com/open-game-system/opengame-app) - Mobile app component

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

- GitHub: [open-game-system](https://github.com/open-game-system)
- Email: [hello@opengame.org](mailto:hello@opengame.org) 