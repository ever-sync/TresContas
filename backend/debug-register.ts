
import axios from 'axios';

async function testRegistration() {
    const api = axios.create({ baseURL: 'http://localhost:3001/api' });
    
    const data = {
        name: 'Escritório de Teste Novo',
        cnpj: '12.345.678/0001-99', // New CNPJ
        email: 'nova@contabilidade.com',
        phone: '(11) 99999-9999',
        password: 'password123'
    };

    try {
        console.log('Testing registration with data:', data);
        const response = await api.post('/auth/register', data);
        console.log('✅ Registration successful!', response.status);
        console.log('User:', response.data.user);
    } catch (error: any) {
        if (error.response) {
            console.error('❌ Registration failed!', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testRegistration();
