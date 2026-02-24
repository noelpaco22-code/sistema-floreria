const express = require('express');
const path = require('path');
const multer = require('multer');
const pool = require('./db');
const session = require('express-session');
const fs = require('fs');
const crypto = require('crypto'); // Necesario para generar retos seguros

// --- NUEVA LIBRERÍA PARA HUELLA ---
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
const PORT = 3000;

// --- CONFIGURACIÓN DINÁMICA DE BIOMETRÍA ---
let dynamicRpID = '';
let dynamicOrigin = '';

// --- CONFIGURACIÓN DE IMÁGENES ---
const storage = multer.diskStorage({
    destination: 'public/img',
    filename: (req, file, cb) => {
        cb(null, 'flor-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

app.set('view engine', 'ejs');
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- SESIONES CORREGIDAS PARA NGROK Y HUELLA ---
app.set('trust proxy', 1); 
app.use(session({
    secret: 'margarita-cliente-secret', 
    resave: false,
    saveUninitialized: false,
    proxy: true, // Vital para Ngrok
    cookie: { 
        secure: true, // WebAuthn requiere HTTPS (Ngrok lo da)
        sameSite: 'none', // Permite que la sesión persista en el túnel
        maxAge: 3600000 
    } 
}));

// Middleware para detectar el dominio actual (Ngrok o Localhost)
app.use((req, res, next) => {
    // Detecta el host correctamente (ej: unmanageable...ngrok-free.dev)
    dynamicRpID = req.get('host').split(':')[0]; 
    dynamicOrigin = `${req.protocol}://${req.get('host')}`;
    res.locals.user = req.session.user || null;
    next();
});

// --- MIDDLEWARE DE PROTECCIÓN ---
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.rol === 'admin') {
        return next();
    }
    res.redirect('/?status=error_auth');
}

// --- RUTA CLIENTE ---
app.get('/', async (req, res) => {
    try {
        const productosResult = await pool.query(`
            SELECT p.*, c.nombre as categoria 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.id DESC
        `);
        const categoriasResult = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');

        res.render('index', { 
            productos: productosResult.rows, 
            categorias: categoriasResult.rows 
        });
    } catch (err) { 
        console.error("Error en tienda:", err.message);
        res.status(500).send("Error al cargar la tienda"); 
    }
});

// --- REGISTRO / LOGIN CLIENTES ---
app.post('/registro', async (req, res) => {
    const { nombre, email, password } = req.body;
    try {
        await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
            [nombre, email, password, 'cliente']
        );
        res.redirect('/?status=success_registro'); 
    } catch (err) {
        res.redirect('/?status=error_registro');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND password = $2 AND rol = $3',
            [email, password, 'cliente']
        );
        if (result.rows.length > 0) {
            req.session.user = result.rows[0]; 
            req.session.save(() => {
                res.redirect('/?status=success_login');
            });
        } else {
            res.redirect('/?status=error_auth');
        }
    } catch (err) {
        res.redirect('/?status=error_server');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- SISTEMA DE ADMIN Y HUELLA ---

app.post('/admin/dashboard-login', async (req, res) => {
    const { adminUser, adminPass } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND password = $2 AND rol = $3', 
            [adminUser, adminPass, 'admin']
        );
        if (result.rows.length > 0) {
            req.session.user = result.rows[0];
            req.session.save((err) => {
                if(err) console.error("Error al guardar sesión:", err);
                res.redirect('/admin?status=welcome'); 
            });
        } else {
            res.redirect('/?status=error_auth'); 
        }
    } catch (err) {
        res.redirect('/?status=error_server');
    }
});

// 1. Iniciar registro de huella
app.get('/admin/webauthn-register-options', isAdmin, async (req, res) => {
    const user = req.session.user;
    try {
        const options = await generateRegistrationOptions({
            rpName: 'Florería Margarita',
            rpID: dynamicRpID,
            userID: user.id.toString(),
            userName: user.email,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform', 
            },
        });
        req.session.currentChallenge = options.challenge;
        req.session.save(() => {
            res.json(options);
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Verificar y guardar la huella
app.post('/admin/webauthn-verify-register', isAdmin, async (req, res) => {
    const { body } = req;
    const expectedChallenge = req.session.currentChallenge;

    try {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: dynamicOrigin,
            expectedRPID: dynamicRpID,
        });

        if (verification.verified) {
            const { credentialID, credentialPublicKey } = verification.registrationInfo;
            await pool.query(
                'UPDATE usuarios SET webauthn_id = $1, public_key = $2 WHERE id = $3',
                [
                    Buffer.from(credentialID).toString('base64'),
                    Buffer.from(credentialPublicKey).toString('base64'),
                    req.session.user.id
                ]
            );
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// 3. Login con huella (GENERAR OPCIONES)
app.post('/admin/webauthn-login-options', async (req, res) => {
    const { email } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND rol = $2', [email, 'admin']);
        const user = userRes.rows[0];

        if (!user || !user.webauthn_id) {
            return res.status(400).json({ error: 'Este admin no tiene huella registrada.' });
        }

        const options = await generateAuthenticationOptions({
            rpID: dynamicRpID,
            allowCredentials: [{
                id: Buffer.from(user.webauthn_id, 'base64'),
                type: 'public-key',
                transports: ['internal'],
            }],
            userVerification: 'preferred',
        });

        req.session.currentChallenge = options.challenge;
        req.session.loginUserEmail = email; // Guardamos para verificar luego
        req.session.save(() => {
            res.json(options);
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Login con huella (VERIFICAR)
app.post('/admin/webauthn-login-verify', async (req, res) => {
    const { body } = req.body;
    const email = req.session.loginUserEmail;
    const expectedChallenge = req.session.currentChallenge;

    try {
        const userRes = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const user = userRes.rows[0];

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: dynamicOrigin,
            expectedRPID: dynamicRpID,
            authenticator: {
                credentialID: Buffer.from(user.webauthn_id, 'base64'),
                credentialPublicKey: Buffer.from(user.public_key, 'base64'),
                counter: 0,
            },
        });

        if (verification.verified) {
            req.session.user = user;
            req.session.save(() => {
                res.json({ success: true });
            });
        } else {
            res.status(400).json({ error: 'Fallo en la verificación biométrica' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- GESTIÓN DE TIENDA (ADMIN) ---

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const prod = await pool.query(`
            SELECT p.*, c.nombre as categoria 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id 
            ORDER BY p.id DESC
        `);
        const cats = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');
        let pedsRows = [];
        try {
            const peds = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
            pedsRows = peds.rows;
        } catch (e) { }

        res.render('admin', { 
            productos: prod.rows, 
            categorias: cats.rows, 
            pedidos: pedsRows 
        });
    } catch (err) { 
        res.status(500).send("Error al cargar el panel."); 
    }
});

// ... (El resto de tus rutas de agregar flor, editar, etc. se mantienen igual) ...

app.post('/admin/agregar-categoria', isAdmin, async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre || nombre.trim() === "") return res.status(400).json({error: "Nombre vacío"});
        const nombreLimpio = nombre.trim();
        const existe = await pool.query('SELECT * FROM categorias WHERE LOWER(nombre) = LOWER($1)', [nombreLimpio]);
        if (existe.rows.length === 0) {
            const nuevo = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [nombreLimpio]);
            res.json({ success: true, id: nuevo.rows[0].id, nombre: nombreLimpio });
        } else {
            res.status(400).json({error: "La categoría ya existe"});
        }
    } catch (err) { res.status(500).json({error: "Error de servidor"}); }
});

app.post('/admin/eliminar-categoria/:id', isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM categorias WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "No se puede eliminar: tiene productos asociados" }); }
});

app.post('/admin/agregar-flor', isAdmin, upload.single('imagen'), async (req, res) => {
    try {
        const { nombre, precio, stock, categoria_id, descripcion } = req.body;
        const img = req.file ? `/img/${req.file.filename}` : '/img/default.jpg';
        const nuevo = await pool.query(
            'INSERT INTO productos (nombre, precio, stock, imagen_url, categoria_id, descripcion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', 
            [nombre, parseFloat(precio) || 0, parseInt(stock) || 0, img, categoria_id || null, descripcion || '']
        );
        res.status(200).json({ success: true, id: nuevo.rows[0].id, nombre, precio, stock, imagen_url: img });
    } catch (err) { res.status(500).json({ error: "Error al guardar producto" }); }
});

app.post('/admin/editar-flor', isAdmin, upload.single('imagen'), async (req, res) => {
    try {
        const { id, nombre, precio, stock, categoria_id } = req.body;
        if(!id) return res.status(400).json({error: "Falta el ID"});
        if (req.file) {
            const viejo = await pool.query('SELECT imagen_url FROM productos WHERE id = $1', [id]);
            if(viejo.rows[0] && viejo.rows[0].imagen_url !== '/img/default.jpg') {
                const viejaRuta = path.join(__dirname, 'public', viejo.rows[0].imagen_url);
                if(fs.existsSync(viejaRuta)) fs.unlinkSync(viejaRuta);
            }
            const imgUrl = `/img/${req.file.filename}`;
            await pool.query('UPDATE productos SET nombre=$1, precio=$2, stock=$3, categoria_id=$4, imagen_url=$5 WHERE id=$6', [nombre, parseFloat(precio), parseInt(stock), categoria_id, imgUrl, id]);
        } else {
            await pool.query('UPDATE productos SET nombre=$1, precio=$2, stock=$3, categoria_id=$4 WHERE id=$5', [nombre, parseFloat(precio), parseInt(stock), categoria_id, id]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error al editar" }); }
});

app.post('/admin/eliminar/:id', isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await pool.query('SELECT imagen_url FROM productos WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const imagenUrl = result.rows[0].imagen_url;
            if (imagenUrl && imagenUrl !== '/img/default.jpg') {
                const rutaFisica = path.join(__dirname, 'public', imagenUrl);
                if (fs.existsSync(rutaFisica)) fs.unlinkSync(rutaFisica);
            }
        }
        await pool.query('DELETE FROM productos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error al eliminar" }); }
});

app.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
});