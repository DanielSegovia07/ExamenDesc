const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const examenRoutes = require('./routes/examenRoutes');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/api/examen', examenRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server at port ${PORT}`));