# AL HAYAT Backend

## Setup
1. `cp .env.example .env`
2. Set `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`
3. `npm install`
4. `npm run seed`
5. `npm start` or `npm run dev`

## Generate admin hash

node -e "import('bcryptjs').then(b => b.default.hash('yourpassword', 12).then(console.log))"

## API
- POST /api/auth/login | logout | GET /me
- GET /api/menu | /categories | /:id
- POST/PUT/DELETE /api/menu (admin)
- POST /api/orders | GET (admin) | PUT /:id/status
- GET/POST/DELETE /api/gallery
- POST /api/messages | GET (admin)
- GET /api/admin/stats | categories CRUD
