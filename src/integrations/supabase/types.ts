export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abatimentos_historico: {
        Row: {
          created_at: string
          forma_pagamento: string
          id: string
          valor: number
          valor_especie: number | null
          valor_pix: number | null
          venda_id: string
        }
        Insert: {
          created_at?: string
          forma_pagamento?: string
          id?: string
          valor: number
          valor_especie?: number | null
          valor_pix?: number | null
          venda_id: string
        }
        Update: {
          created_at?: string
          forma_pagamento?: string
          id?: string
          valor?: number
          valor_especie?: number | null
          valor_pix?: number | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abatimentos_historico_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string | null
          role_solicitado: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          role_solicitado?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          role_solicitado?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          dispositivo: string | null
          id: string
          modulo: string
          registro_afetado: string | null
          usuario_nome: string
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          dispositivo?: string | null
          id?: string
          modulo: string
          registro_afetado?: string | null
          usuario_nome?: string
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          dispositivo?: string | null
          id?: string
          modulo?: string
          registro_afetado?: string | null
          usuario_nome?: string
        }
        Relationships: []
      }
      avarias: {
        Row: {
          created_at: string
          id: string
          motivo: string
          operador: string
          quantidade: number
          sabor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          operador?: string
          quantidade: number
          sabor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          operador?: string
          quantidade?: number
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avarias_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_preco_sabor: {
        Row: {
          cliente_id: string
          id: string
          preco_unitario: number
          sabor_id: string
        }
        Insert: {
          cliente_id: string
          id?: string
          preco_unitario: number
          sabor_id: string
        }
        Update: {
          cliente_id?: string
          id?: string
          preco_unitario?: number
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_preco_sabor_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_preco_sabor_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_tabela_preco: {
        Row: {
          cliente_id: string
          id: string
          preco_unitario: number
          quantidade_minima: number
        }
        Insert: {
          cliente_id: string
          id?: string
          preco_unitario: number
          quantidade_minima: number
        }
        Update: {
          cliente_id?: string
          id?: string
          preco_unitario?: number
          quantidade_minima?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_tabela_preco_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          freezer_identificacao: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          observacoes: string | null
          possui_freezer: boolean
          preco_padrao_personalizado: number | null
          status: Database["public"]["Enums"]["status_cliente"]
          telefone: string | null
          ultima_compra: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          freezer_identificacao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          observacoes?: string | null
          possui_freezer?: boolean
          preco_padrao_personalizado?: number | null
          status?: Database["public"]["Enums"]["status_cliente"]
          telefone?: string | null
          ultima_compra?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          freezer_identificacao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          observacoes?: string | null
          possui_freezer?: boolean
          preco_padrao_personalizado?: number | null
          status?: Database["public"]["Enums"]["status_cliente"]
          telefone?: string | null
          ultima_compra?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contas_a_pagar: {
        Row: {
          ativa: boolean
          created_at: string
          descricao: string
          id: string
          mes_referencia: string | null
          pago_mes: boolean
          parcela_atual: number | null
          proxima_parcela_data: string | null
          responsavel: string | null
          tipo: string
          total_parcelas: number | null
          updated_at: string
          valor_parcela: number
          valor_restante: number | null
          valor_total: number | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          descricao: string
          id?: string
          mes_referencia?: string | null
          pago_mes?: boolean
          parcela_atual?: number | null
          proxima_parcela_data?: string | null
          responsavel?: string | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor_parcela?: number
          valor_restante?: number | null
          valor_total?: number | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          descricao?: string
          id?: string
          mes_referencia?: string | null
          pago_mes?: boolean
          parcela_atual?: number | null
          proxima_parcela_data?: string | null
          responsavel?: string | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor_parcela?: number
          valor_restante?: number | null
          valor_total?: number | null
        }
        Relationships: []
      }
      contato_landing: {
        Row: {
          created_at: string
          email: string
          id: string
          mensagem: string
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          mensagem: string
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          mensagem?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      decisoes_producao: {
        Row: {
          ajuste: number | null
          created_at: string
          dia_semana: number
          dias_cobertura: number
          estoque_no_momento: number
          id: string
          lotes_autorizados: number
          lotes_sugeridos: number
          media_diaria: number
          operador: string
          sabor_id: string
          sabor_nome: string
          vendas_7d: number
        }
        Insert: {
          ajuste?: number | null
          created_at?: string
          dia_semana: number
          dias_cobertura?: number
          estoque_no_momento?: number
          id?: string
          lotes_autorizados?: number
          lotes_sugeridos?: number
          media_diaria?: number
          operador?: string
          sabor_id: string
          sabor_nome: string
          vendas_7d?: number
        }
        Update: {
          ajuste?: number | null
          created_at?: string
          dia_semana?: number
          dias_cobertura?: number
          estoque_no_momento?: number
          id?: string
          lotes_autorizados?: number
          lotes_sugeridos?: number
          media_diaria?: number
          operador?: string
          sabor_id?: string
          sabor_nome?: string
          vendas_7d?: number
        }
        Relationships: [
          {
            foreignKeyName: "decisoes_producao_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      embalagens: {
        Row: {
          created_at: string
          estoque_atual: number
          estoque_minimo: number
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_freezer: {
        Row: {
          cliente_id: string
          id: string
          quantidade: number
          sabor_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          id?: string
          quantidade?: number
          sabor_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          id?: string
          quantidade?: number
          sabor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_freezer_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_freezer_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_gelos: {
        Row: {
          id: string
          quantidade: number
          sabor_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          quantidade?: number
          sabor_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          quantidade?: number
          sabor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_gelos_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: true
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_mensagens: {
        Row: {
          created_at: string
          data_agendada: string
          data_envio: string | null
          id: string
          mensagem_editada: string | null
          mensagem_gerada: string
          prospecto_id: string
          resposta_cliente: string | null
          resultado: string | null
          status: string
          tom: string | null
          updated_at: string
          visita_id: string | null
        }
        Insert: {
          created_at?: string
          data_agendada: string
          data_envio?: string | null
          id?: string
          mensagem_editada?: string | null
          mensagem_gerada: string
          prospecto_id: string
          resposta_cliente?: string | null
          resultado?: string | null
          status?: string
          tom?: string | null
          updated_at?: string
          visita_id?: string | null
        }
        Update: {
          created_at?: string
          data_agendada?: string
          data_envio?: string | null
          id?: string
          mensagem_editada?: string | null
          mensagem_gerada?: string
          prospecto_id?: string
          resposta_cliente?: string | null
          resultado?: string | null
          status?: string
          tom?: string | null
          updated_at?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_mensagens_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_mensagens_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "prospecto_visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tipo_pagamento: Database["public"]["Enums"]["tipo_pagamento_funcionario"]
          updated_at: string
          valor_pagamento: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          tipo_pagamento?: Database["public"]["Enums"]["tipo_pagamento_funcionario"]
          updated_at?: string
          valor_pagamento?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tipo_pagamento?: Database["public"]["Enums"]["tipo_pagamento_funcionario"]
          updated_at?: string
          valor_pagamento?: number
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      materias_primas: {
        Row: {
          created_at: string
          estoque_atual: number
          estoque_minimo: number
          id: string
          nome: string
          unidade: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome: string
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          id: string
          item_id: string
          operador: string
          quantidade: number
          referencia: string | null
          referencia_id: string | null
          tipo_item: Database["public"]["Enums"]["tipo_item_estoque"]
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          operador?: string
          quantidade: number
          referencia?: string | null
          referencia_id?: string | null
          tipo_item: Database["public"]["Enums"]["tipo_item_estoque"]
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          operador?: string
          quantidade?: number
          referencia?: string | null
          referencia_id?: string | null
          tipo_item?: Database["public"]["Enums"]["tipo_item_estoque"]
          tipo_movimentacao?: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Relationships: []
      }
      pedido_producao_itens: {
        Row: {
          id: string
          pedido_id: string
          quantidade: number
          sabor_id: string
          separado: boolean
        }
        Insert: {
          id?: string
          pedido_id: string
          quantidade: number
          sabor_id: string
          separado?: boolean
        }
        Update: {
          id?: string
          pedido_id?: string
          quantidade?: number
          sabor_id?: string
          separado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pedido_producao_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_producao_itens_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_producao: {
        Row: {
          cliente_id: string
          created_at: string
          data_entrega: string
          id: string
          observacoes: string | null
          operador: string
          status: Database["public"]["Enums"]["status_pedido_producao"]
          status_pagamento: string
          tipo_embalagem: string
          tipo_pedido: string
          updated_at: string
          venda_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_entrega: string
          id?: string
          observacoes?: string | null
          operador?: string
          status?: Database["public"]["Enums"]["status_pedido_producao"]
          status_pagamento?: string
          tipo_embalagem?: string
          tipo_pedido?: string
          updated_at?: string
          venda_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_entrega?: string
          id?: string
          observacoes?: string | null
          operador?: string
          status?: Database["public"]["Enums"]["status_pedido_producao"]
          status_pagamento?: string
          tipo_embalagem?: string
          tipo_pedido?: string
          updated_at?: string
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_producao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_producao_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_publicos: {
        Row: {
          bairro: string
          created_at: string
          endereco: string
          forma_pagamento: string
          id: string
          itens: Json
          nome_cliente: string
          observacoes: string | null
          preco_unitario: number
          status: string
          telefone: string
          total_itens: number
          updated_at: string
          valor_total: number
        }
        Insert: {
          bairro: string
          created_at?: string
          endereco: string
          forma_pagamento?: string
          id?: string
          itens?: Json
          nome_cliente: string
          observacoes?: string | null
          preco_unitario?: number
          status?: string
          telefone: string
          total_itens?: number
          updated_at?: string
          valor_total?: number
        }
        Update: {
          bairro?: string
          created_at?: string
          endereco?: string
          forma_pagamento?: string
          id?: string
          itens?: Json
          nome_cliente?: string
          observacoes?: string | null
          preco_unitario?: number
          status?: string
          telefone?: string
          total_itens?: number
          updated_at?: string
          valor_total?: number
        }
        Relationships: []
      }
      presenca_producao: {
        Row: {
          confirmado_por: string | null
          created_at: string
          data: string
          funcionario_id: string
          id: string
        }
        Insert: {
          confirmado_por?: string | null
          created_at?: string
          data?: string
          funcionario_id: string
          id?: string
        }
        Update: {
          confirmado_por?: string | null
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenca_producao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_funcionarios: {
        Row: {
          funcionario_id: string
          id: string
          producao_id: string
          quantidade_produzida: number
        }
        Insert: {
          funcionario_id: string
          id?: string
          producao_id: string
          quantidade_produzida?: number
        }
        Update: {
          funcionario_id?: string
          id?: string
          producao_id?: string
          quantidade_produzida?: number
        }
        Relationships: [
          {
            foreignKeyName: "producao_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_funcionarios_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      producoes: {
        Row: {
          created_at: string
          id: string
          modo: Database["public"]["Enums"]["modo_producao"]
          observacoes: string | null
          operador: string
          quantidade_lotes: number
          quantidade_total: number
          sabor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modo?: Database["public"]["Enums"]["modo_producao"]
          observacoes?: string | null
          operador?: string
          quantidade_lotes?: number
          quantidade_total: number
          sabor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modo?: Database["public"]["Enums"]["modo_producao"]
          observacoes?: string | null
          operador?: string
          quantidade_lotes?: number
          quantidade_total?: number
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producoes_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      prospecto_visitas: {
        Row: {
          created_at: string
          data_visita: string
          feedback: string | null
          id: string
          operador: string
          produto_apresentado: string | null
          prospecto_id: string
          proxima_acao: string | null
          resultado: Database["public"]["Enums"]["status_prospecto"]
        }
        Insert: {
          created_at?: string
          data_visita?: string
          feedback?: string | null
          id?: string
          operador?: string
          produto_apresentado?: string | null
          prospecto_id: string
          proxima_acao?: string | null
          resultado: Database["public"]["Enums"]["status_prospecto"]
        }
        Update: {
          created_at?: string
          data_visita?: string
          feedback?: string | null
          id?: string
          operador?: string
          produto_apresentado?: string | null
          prospecto_id?: string
          proxima_acao?: string | null
          resultado?: Database["public"]["Enums"]["status_prospecto"]
        }
        Relationships: [
          {
            foreignKeyName: "prospecto_visitas_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["id"]
          },
        ]
      }
      prospectos: {
        Row: {
          bairro: string | null
          contato_nome: string | null
          created_at: string
          endereco: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          observacoes_estrategicas: string | null
          operador: string
          perfil_publico: string | null
          prioridade: Database["public"]["Enums"]["prioridade_prospecto"]
          score: number
          script_abordagem: string | null
          status: Database["public"]["Enums"]["status_prospecto"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_prospecto"]
          updated_at: string
          volume_potencial: string | null
        }
        Insert: {
          bairro?: string | null
          contato_nome?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          observacoes_estrategicas?: string | null
          operador?: string
          perfil_publico?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_prospecto"]
          score?: number
          script_abordagem?: string | null
          status?: Database["public"]["Enums"]["status_prospecto"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_prospecto"]
          updated_at?: string
          volume_potencial?: string | null
        }
        Update: {
          bairro?: string | null
          contato_nome?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          observacoes_estrategicas?: string | null
          operador?: string
          perfil_publico?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_prospecto"]
          score?: number
          script_abordagem?: string | null
          status?: Database["public"]["Enums"]["status_prospecto"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_prospecto"]
          updated_at?: string
          volume_potencial?: string | null
        }
        Relationships: []
      }
      sabor_receita: {
        Row: {
          embalagem_id: string
          embalagens_por_lote: number
          gelos_por_lote: number
          id: string
          materia_prima_id: string
          quantidade_insumo_por_lote: number
          sabor_id: string
        }
        Insert: {
          embalagem_id: string
          embalagens_por_lote?: number
          gelos_por_lote?: number
          id?: string
          materia_prima_id: string
          quantidade_insumo_por_lote?: number
          sabor_id: string
        }
        Update: {
          embalagem_id?: string
          embalagens_por_lote?: number
          gelos_por_lote?: number
          id?: string
          materia_prima_id?: string
          quantidade_insumo_por_lote?: number
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sabor_receita_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sabor_receita_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sabor_receita_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: true
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      sabores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imagem_url: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem_url?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem_url?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          id: string
          preco_unitario: number
          quantidade: number
          regra_preco_aplicada: string
          sabor_id: string
          subtotal: number
          venda_id: string
        }
        Insert: {
          id?: string
          preco_unitario: number
          quantidade: number
          regra_preco_aplicada?: string
          sabor_id: string
          subtotal: number
          venda_id: string
        }
        Update: {
          id?: string
          preco_unitario?: number
          quantidade?: number
          regra_preco_aplicada?: string
          sabor_id?: string
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_parcelas: {
        Row: {
          created_at: string
          data_pagamento: string | null
          id: string
          numero: number
          paga: boolean
          valor: number
          vencimento: string
          venda_id: string
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          id?: string
          numero: number
          paga?: boolean
          valor: number
          vencimento: string
          venda_id: string
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          id?: string
          numero?: number
          paga?: boolean
          valor?: number
          vencimento?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_parcelas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_id: string
          created_at: string
          enviado_producao: boolean
          forma_pagamento: string
          id: string
          numero_nf: string | null
          observacoes: string | null
          operador: string
          status: Database["public"]["Enums"]["status_venda"]
          total: number
          updated_at: string
          valor_especie: number
          valor_pago: number
          valor_pix: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          enviado_producao?: boolean
          forma_pagamento?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          operador?: string
          status?: Database["public"]["Enums"]["status_venda"]
          total?: number
          updated_at?: string
          valor_especie?: number
          valor_pago?: number
          valor_pix?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          enviado_producao?: boolean
          forma_pagamento?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          operador?: string
          status?: Database["public"]["Enums"]["status_venda"]
          total?: number
          updated_at?: string
          valor_especie?: number
          valor_pago?: number
          valor_pix?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_preco: {
        Args: { p_cliente_id: string; p_quantidade: number; p_sabor_id: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      realizar_producao:
        | {
            Args: {
              p_funcionarios: Json
              p_modo: Database["public"]["Enums"]["modo_producao"]
              p_observacoes: string
              p_operador: string
              p_quantidade_lotes: number
              p_quantidade_total: number
              p_sabor_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_funcionarios: Json
              p_ignorar_estoque?: boolean
              p_modo: Database["public"]["Enums"]["modo_producao"]
              p_observacoes: string
              p_operador: string
              p_quantidade_lotes: number
              p_quantidade_total: number
              p_sabor_id: string
            }
            Returns: string
          }
      realizar_venda: {
        Args: {
          p_cliente_id: string
          p_ignorar_estoque?: boolean
          p_itens: Json
          p_observacoes: string
          p_operador: string
          p_parcelas?: Json
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "producao"
      modo_producao: "unidade" | "lote"
      prioridade_prospecto: "alta" | "media" | "baixa"
      status_cliente: "ativo" | "inativo"
      status_pedido_producao:
        | "aguardando_producao"
        | "em_producao"
        | "separado_para_entrega"
        | "retirado"
        | "enviado"
      status_prospecto:
        | "novo"
        | "visitado"
        | "interessado"
        | "pedido_fechado"
        | "retornar"
        | "sem_interesse"
      status_venda: "pendente" | "paga" | "cancelada"
      tipo_item_estoque: "materia_prima" | "gelo_pronto" | "embalagem"
      tipo_movimentacao: "entrada" | "saida"
      tipo_pagamento_funcionario: "diaria" | "fixo"
      tipo_prospecto:
        | "bar"
        | "tabacaria"
        | "distribuidora"
        | "casa_noturna"
        | "evento_buffet"
        | "restaurante_lounge"
        | "lanchonete"
        | "mercado"
        | "outro"
      unidade_medida: "g" | "kg"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "producao"],
      modo_producao: ["unidade", "lote"],
      prioridade_prospecto: ["alta", "media", "baixa"],
      status_cliente: ["ativo", "inativo"],
      status_pedido_producao: [
        "aguardando_producao",
        "em_producao",
        "separado_para_entrega",
        "retirado",
        "enviado",
      ],
      status_prospecto: [
        "novo",
        "visitado",
        "interessado",
        "pedido_fechado",
        "retornar",
        "sem_interesse",
      ],
      status_venda: ["pendente", "paga", "cancelada"],
      tipo_item_estoque: ["materia_prima", "gelo_pronto", "embalagem"],
      tipo_movimentacao: ["entrada", "saida"],
      tipo_pagamento_funcionario: ["diaria", "fixo"],
      tipo_prospecto: [
        "bar",
        "tabacaria",
        "distribuidora",
        "casa_noturna",
        "evento_buffet",
        "restaurante_lounge",
        "lanchonete",
        "mercado",
        "outro",
      ],
      unidade_medida: ["g", "kg"],
    },
  },
} as const
