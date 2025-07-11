# Testing the Restaurant Menu Integration

## Quick Test Commands

### 1. Test Development Mode
```bash
# Start both servers
npm run dev

# Wait for both servers to start (should see output from both)
# Then test these URLs in your browser:
```

**Test URLs:**
- Main app: `http://localhost:3000`
- Restaurant menu (via proxy): `http://localhost:3000/menu/3/1`
- Direct menu dev server: `http://localhost:5173`

### 2. Test Production Mode
```bash
# Build everything
npm run build

# Start production server
npm start

# Test these URLs:
```

**Test URLs:**
- Main app: `http://localhost:3000`
- Restaurant menu (static files): `http://localhost:3000/menu/3/1`

## What to Expect

### Development Mode:
- ✅ Hot reload works on both servers
- ✅ Changes in `restaurant-menu/src/` appear immediately
- ✅ Proxy forwards `/menu/*` requests correctly
- ✅ Both servers show in terminal output

### Production Mode:
- ✅ Static files served from `restaurant-menu/dist/`
- ✅ Client-side routing works (all `/menu/*` paths serve the app)
- ✅ Single Express server handles everything
- ✅ No separate Vite dev server needed

## Troubleshooting

If you see errors:
1. **Port conflicts**: Kill existing processes with `taskkill /f /im node.exe`
2. **Missing dependencies**: Run `npm install` in both root and `restaurant-menu/`
3. **Build errors**: Check `restaurant-menu/dist/` exists after `npm run build:menu`

## Success Indicators

✅ **Development**: Both servers running, proxy working, hot reload functional
✅ **Production**: Single server, static files served, routing works
✅ **Build**: No errors, `dist/` folder created successfully 