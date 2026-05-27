async function enviarDados() {
  try {
    const response = await fetch(
      'https://api.npoint.io/7a8a3150e70c5b6fd525',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: 'João',
          email: 'joao@email.com',
          idade: 25,
        }),
      }
    );

    const data = await response.json();

    console.log('Resposta:', data);
  } catch (error) {
    console.error('Erro:', error);
  }
}

enviarDados();