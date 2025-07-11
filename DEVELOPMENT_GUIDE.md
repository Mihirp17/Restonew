# Development Guide - Restaurant Menu Integration

## Overview

The restaurant menu (customer-facing UI) is integrated into the main application with a **reliable development setup** that serves static files.

## Development Mode

In development, the restaurant menu is built to static files and served directly by the Express server, with an optional Vite dev server for hot reload.

### How it works:
1. **Main server** runs on `http://localhost:3000`
2. **Restaurant menu** is built to static files in `restaurant-menu/dist/`
3. **Express server** serves these files at `/menu/*` routes
4. **Optional Vite dev server** runs on `http://localhost:5173` for hot reload during development

### Commands:
```bash
# Start both servers (recommended - builds menu first, then starts both)
npm run dev

# Or start them separately
npm run dev:server    # Main server on port 3000
npm run dev:menu      # Restaurant menu Vite dev server on port 5173 (for hot reload)
npm run dev:menu-only # Just the Vite dev server (for development only)
```

### Access URLs:
- Main app: `http://localhost:3000`
- Restaurant menu: `http://localhost:3000/menu/restaurantId/tableId`
- Direct menu dev server: `http://localhost:5173` (for hot reload development)

### Development Workflow:
1. **Start development**: `npm run dev` (builds menu + starts both servers)
2. **Edit restaurant menu**: Files in `restaurant-menu/src/`
3. **For hot reload**: Use `http://localhost:5173` directly
4. **For testing integration**: Use `http://localhost:3000/menu/3/1`
5. **After changes**: Run `npm run build:menu` to update the served files

## Production Mode

In production, the restaurant menu is built to static files and served directly by the Express server.

### How it works:
1. **Build process** creates static files in `restaurant-menu/dist/`
2. **Express server** serves these files at `/menu/*` routes
3. **Client-side routing** is handled by serving `index.html` for unmatched routes

### Commands:
```bash
# Build everything for production
npm run build

# Build just the restaurant menu
npm run build:menu

# Start production server
npm start
```

### Access URLs:
- Main app: `http://your-domain.com`
- Restaurant menu: `http://your-domain.com/menu/restaurantId/tableId`

## File Structure

```
├── server/
│   └── index.ts              # Main Express server with static serving
├── restaurant-menu/
│   ├── src/                  # Restaurant menu React app
│   ├── dist/                 # Built static files (served by Express)
│   └── package.json          # Restaurant menu dependencies
└── package.json              # Main app dependencies and scripts
```

## Development Workflow

1. **Start development**: `npm run dev`
2. **Edit restaurant menu**: Files in `restaurant-menu/src/`
3. **Hot reload**: Visit `http://localhost:5173` for immediate changes
4. **Test integration**: Visit `http://localhost:3000/menu/3/1` to test the full flow
5. **Update served files**: Run `npm run build:menu` to update what's served at `/menu/*`

## Production Deployment

1. **Build**: `npm run build` (builds both main app and restaurant menu)
2. **Deploy**: Copy `dist/` and `restaurant-menu/dist/` to production server
3. **Start**: `npm start` (serves both apps from single Express server)

## Troubleshooting

### Menu not loading?
- Ensure `restaurant-menu/dist/` folder exists
- Run `npm run build:menu` to create it
- Check server logs for static file serving errors

### Want hot reload?
- Use `http://localhost:5173` directly for development
- Or run `npm run dev:menu-only` in a separate terminal

### Build errors?
- Check if all dependencies are installed: `npm install` in both root and `restaurant-menu/`
- Verify Vite configuration in `restaurant-menu/vite.config.js`

## Benefits of This Approach

✅ **Reliable**: No proxy issues or MIME type errors
✅ **Simple**: Static file serving works consistently
✅ **Fast**: No proxy overhead
✅ **Debuggable**: Clear separation between dev and production
✅ **Flexible**: Can use Vite dev server for hot reload when needed 