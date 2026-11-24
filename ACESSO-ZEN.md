# Acesso único ZEN — homologação

As contas são administradas no ZenControl. O estoque aceita administradores e operadores; técnicos acessam somente o ZenField. Na tela do estoque, use **Entrar com conta ZEN**. A identidade é validada pela central a cada solicitação e o botão **Sair** encerra o acesso nos três aplicativos.

Na API do estoque, configure `ZEN_IDENTITY_API_URL` com a origem da API ZenControl, `ZEN_LOGIN_URL` com a origem da interface central e `ZENCONTROL_INTEGRATION_SECRET` com o mesmo segredo privado usado na integração do estoque. Nunca coloque esse segredo no frontend. O inicializador de homologação configura esses valores em loopback automaticamente.

A migração 005 acrescenta somente um vínculo de identidade na tabela de usuários, sem alterar contas nativas. Quando o acesso único estiver ativado, o login e o gerenciamento de contas locais ficam desabilitados; contas ZEN não são associadas por coincidência de nome ou login. A senha atual da conta ZEN continua obrigatória para reset e restauração do estoque.
