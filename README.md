# Vistoria e Registro de Veículos

Aplicativo Android offline para registro de vistorias veiculares.

## Fluxo

1. Cadastrar a blitz.
2. Informar placa, dia, hora e status.
3. Capturar obrigatoriamente duas fotos.
4. Salvar o registro localmente.
5. As fotos são gravadas em `Download/RegistroFoto/<PLACA>/`.
6. O arquivo `Download/Registros.csv` é mantido sincronizado.
7. O botão **Compartilhar no WhatsApp** abre o compartilhamento nativo com o relatório e as duas fotos anexadas.

## Armazenamento

O aplicativo não depende de servidor. Os dados do registro ficam no armazenamento local do aplicativo e as fotos ficam fisicamente na pasta pública `Download/RegistroFoto` do aparelho.

Estrutura das fotos:

```text
Download/
└── RegistroFoto/
    ├── ABC1234/
    │   ├── ID1_foto1.jpg
    │   └── ID1_foto2.jpg
    └── XYZ9876/
        ├── ID2_foto1.jpg
        └── ID2_foto2.jpg
```

O ID no nome do arquivo evita sobrescrever as fotos caso a mesma placa apareça em mais de um registro.

## Desenvolvimento

```bash
npm install
npm run dev
```

Para gerar a aplicação web:

```bash
npm run build
```

Para atualizar o projeto Android após qualquer alteração no código:

```bash
npm run build
npx cap sync android
```

Depois, abra o projeto Android no Android Studio ou gere o APK pelo Gradle/CI.
