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
          factory_id: string | null
          forma_pagamento: string
          id: string
          valor: number
          valor_especie: number | null
          valor_pix: number | null
          venda_id: string
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          forma_pagamento?: string
          id?: string
          valor: number
          valor_especie?: number | null
          valor_pix?: number | null
          venda_id: string
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          forma_pagamento?: string
          id?: string
          valor?: number
          valor_especie?: number | null
          valor_pix?: number | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abatimentos_historico_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
          id?: string
          modulo?: string
          registro_afetado?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      avarias: {
        Row: {
          created_at: string
          factory_id: string | null
          id: string
          motivo: string
          operador: string
          quantidade: number
          sabor_id: string
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          id?: string
          motivo: string
          operador?: string
          quantidade: number
          sabor_id: string
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          id?: string
          motivo?: string
          operador?: string
          quantidade?: number
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avarias_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
          id: string
          preco_unitario: number
          sabor_id: string
        }
        Insert: {
          cliente_id: string
          factory_id?: string | null
          id?: string
          preco_unitario: number
          sabor_id: string
        }
        Update: {
          cliente_id?: string
          factory_id?: string | null
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
            foreignKeyName: "cliente_preco_sabor_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
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
          factory_id: string | null
          id: string
          preco_unitario: number
          quantidade_minima: number
        }
        Insert: {
          cliente_id: string
          factory_id?: string | null
          id?: string
          preco_unitario: number
          quantidade_minima: number
        }
        Update: {
          cliente_id?: string
          factory_id?: string | null
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
          {
            foreignKeyName: "cliente_tabela_preco_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "clientes_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          custo_total_com_frete: number
          custo_unitario_com_frete: number
          factory_id: string | null
          fornecedor_id: string | null
          id: string
          item_id: string | null
          item_nome: string
          observacoes: string | null
          quantidade: number
          tem_frete: boolean
          tipo: string
          updated_at: string
          valor_frete: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          custo_total_com_frete?: number
          custo_unitario_com_frete?: number
          factory_id?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id?: string | null
          item_nome: string
          observacoes?: string | null
          quantidade?: number
          tem_frete?: boolean
          tipo?: string
          updated_at?: string
          valor_frete?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          custo_total_com_frete?: number
          custo_unitario_com_frete?: number
          factory_id?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id?: string | null
          item_nome?: string
          observacoes?: string | null
          quantidade?: number
          tem_frete?: boolean
          tipo?: string
          updated_at?: string
          valor_frete?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_a_pagar: {
        Row: {
          ativa: boolean
          created_at: string
          descricao: string
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      contato_landing: {
        Row: {
          created_at: string
          email: string
          factory_id: string | null
          id: string
          mensagem: string
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          factory_id?: string | null
          id?: string
          mensagem: string
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          factory_id?: string | null
          id?: string
          mensagem?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contato_landing_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      decisoes_producao: {
        Row: {
          ajuste: number | null
          created_at: string
          dia_semana: number
          dias_cobertura: number
          estoque_no_momento: number
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
            foreignKeyName: "decisoes_producao_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          factory_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          factory_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embalagens_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_freezer: {
        Row: {
          cliente_id: string
          factory_id: string | null
          id: string
          quantidade: number
          sabor_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          factory_id?: string | null
          id?: string
          quantidade?: number
          sabor_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          factory_id?: string | null
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
            foreignKeyName: "estoque_freezer_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
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
          factory_id: string | null
          id: string
          quantidade: number
          sabor_id: string
          updated_at: string
        }
        Insert: {
          factory_id?: string | null
          id?: string
          quantidade?: number
          sabor_id: string
          updated_at?: string
        }
        Update: {
          factory_id?: string | null
          id?: string
          quantidade?: number
          sabor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_gelos_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_gelos_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: true
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_sacos: {
        Row: {
          factory_id: string | null
          id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          factory_id?: string | null
          id?: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          factory_id?: string | null
          id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_sacos_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: true
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      factories: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          endereco: string | null
          estado: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          max_collaborators: number | null
          name: string
          owner_id: string
          theme: Json | null
          unidades_por_saco: number
          updated_at: string | null
          usa_sacos: boolean
          vende_gelo_cubo: boolean
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          max_collaborators?: number | null
          name: string
          owner_id: string
          theme?: Json | null
          unidades_por_saco?: number
          updated_at?: string | null
          usa_sacos?: boolean
          vende_gelo_cubo?: boolean
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          max_collaborators?: number | null
          name?: string
          owner_id?: string
          theme?: Json | null
          unidades_por_saco?: number
          updated_at?: string | null
          usa_sacos?: boolean
          vende_gelo_cubo?: boolean
        }
        Relationships: []
      }
      factory_preco_sabor: {
        Row: {
          created_at: string
          factory_id: string | null
          id: string
          preco_unitario: number
          sabor_id: string | null
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          id?: string
          preco_unitario: number
          sabor_id?: string | null
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          id?: string
          preco_unitario?: number
          sabor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factory_preco_sabor_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factory_preco_sabor_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_pricing_tiers: {
        Row: {
          created_at: string
          factory_id: string | null
          id: string
          preco_unitario: number
          quantidade_minima: number
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          id?: string
          preco_unitario?: number
          quantidade_minima?: number
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          id?: string
          preco_unitario?: number
          quantidade_minima?: number
        }
        Relationships: [
          {
            foreignKeyName: "factory_pricing_tiers_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_mensagens: {
        Row: {
          created_at: string
          data_agendada: string
          data_envio: string | null
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
            foreignKeyName: "followup_mensagens_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
      fornecedores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          factory_id: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          factory_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          factory_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          created_at: string
          factory_id: string | null
          id: string
          nome: string
          setor: string
          tipo_pagamento: Database["public"]["Enums"]["tipo_pagamento_funcionario"]
          updated_at: string
          valor_pagamento: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          factory_id?: string | null
          id?: string
          nome: string
          setor?: string
          tipo_pagamento?: Database["public"]["Enums"]["tipo_pagamento_funcionario"]
          updated_at?: string
          valor_pagamento?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          factory_id?: string | null
          id?: string
          nome?: string
          setor?: string
          tipo_pagamento?: Database["public"]["Enums"]["tipo_pagamento_funcionario"]
          updated_at?: string
          valor_pagamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      gelo_cubo_precos: {
        Row: {
          created_at: string
          factory_id: string
          id: string
          preco: number
          tamanho: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          factory_id: string
          id?: string
          preco?: number
          tamanho: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          factory_id?: string
          id?: string
          preco?: number
          tamanho?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gelo_cubo_precos_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
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
          factory_id: string | null
          id: string
          nome: string
          unidade: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          factory_id?: string | null
          id?: string
          nome: string
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          factory_id?: string | null
          id?: string
          nome?: string
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materias_primas_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
          id?: string
          item_id?: string
          operador?: string
          quantidade?: number
          referencia?: string | null
          referencia_id?: string | null
          tipo_item?: Database["public"]["Enums"]["tipo_item_estoque"]
          tipo_movimentacao?: Database["public"]["Enums"]["tipo_movimentacao"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_producao_itens: {
        Row: {
          factory_id: string | null
          id: string
          pedido_id: string
          quantidade: number
          sabor_id: string
          separado: boolean
        }
        Insert: {
          factory_id?: string | null
          id?: string
          pedido_id: string
          quantidade: number
          sabor_id: string
          separado?: boolean
        }
        Update: {
          factory_id?: string | null
          id?: string
          pedido_id?: string
          quantidade?: number
          sabor_id?: string
          separado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pedido_producao_itens_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
            foreignKeyName: "pedidos_producao_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "pedidos_publicos_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_semanal_itens: {
        Row: {
          created_at: string
          dia_semana: number
          factory_id: string | null
          id: string
          plano_id: string
          quantidade: number
          sabor_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          factory_id?: string | null
          id?: string
          plano_id: string
          quantidade?: number
          sabor_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          factory_id?: string | null
          id?: string
          plano_id?: string
          quantidade?: number
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_semanal_itens_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_semanal_itens_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_semanais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_semanal_itens_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_semanais: {
        Row: {
          created_at: string
          factory_id: string | null
          id: string
          nome: string
          semana_inicio: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          id?: string
          nome?: string
          semana_inicio: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          id?: string
          nome?: string
          semana_inicio?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_semanais_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      presenca_producao: {
        Row: {
          confirmado_por: string | null
          created_at: string
          data: string
          factory_id: string | null
          funcionario_id: string
          id: string
        }
        Insert: {
          confirmado_por?: string | null
          created_at?: string
          data?: string
          factory_id?: string | null
          funcionario_id: string
          id?: string
        }
        Update: {
          confirmado_por?: string | null
          created_at?: string
          data?: string
          factory_id?: string | null
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenca_producao_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
          funcionario_id: string
          id: string
          producao_id: string
          quantidade_produzida: number
        }
        Insert: {
          factory_id?: string | null
          funcionario_id: string
          id?: string
          producao_id: string
          quantidade_produzida?: number
        }
        Update: {
          factory_id?: string | null
          funcionario_id?: string
          id?: string
          producao_id?: string
          quantidade_produzida?: number
        }
        Relationships: [
          {
            foreignKeyName: "producao_funcionarios_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
            foreignKeyName: "producoes_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          factory_id?: string | null
          id: string
          nome?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          factory_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecto_visitas: {
        Row: {
          created_at: string
          data_visita: string
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
            foreignKeyName: "prospecto_visitas_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "prospectos_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      sabor_receita: {
        Row: {
          embalagem_id: string
          embalagens_por_lote: number
          factory_id: string | null
          gelos_por_lote: number
          id: string
          materia_prima_id: string
          quantidade_insumo_por_lote: number
          sabor_id: string
        }
        Insert: {
          embalagem_id: string
          embalagens_por_lote?: number
          factory_id?: string | null
          gelos_por_lote?: number
          id?: string
          materia_prima_id: string
          quantidade_insumo_por_lote?: number
          sabor_id: string
        }
        Update: {
          embalagem_id?: string
          embalagens_por_lote?: number
          factory_id?: string | null
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
            foreignKeyName: "sabor_receita_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
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
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      sabores: {
        Row: {
          ativo: boolean
          created_at: string
          factory_id: string | null
          id: string
          imagem_url: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          factory_id?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          factory_id?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sabores_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number | null
          blocked_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          factory_id: string
          grace_until: string | null
          id: string
          paid_at: string | null
          status: string
          trial_start: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          blocked_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          factory_id: string
          grace_until?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          trial_start?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          blocked_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          factory_id?: string
          grace_until?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          trial_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: true
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_name: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_name?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_name?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          factory_id: string | null
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          factory_id?: string | null
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          factory_id?: string | null
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          factory_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          factory_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          factory_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          duration_minutes: number
          factory_id: string | null
          id: string
          last_seen_at: string
          started_at: string
          user_id: string
        }
        Insert: {
          duration_minutes?: number
          factory_id?: string | null
          id?: string
          last_seen_at?: string
          started_at?: string
          user_id: string
        }
        Update: {
          duration_minutes?: number
          factory_id?: string | null
          id?: string
          last_seen_at?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_gelo_cubo_itens: {
        Row: {
          created_at: string
          factory_id: string | null
          id: string
          preco_unitario: number
          quantidade: number
          subtotal: number
          tamanho: string
          venda_id: string
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          id?: string
          preco_unitario: number
          quantidade?: number
          subtotal: number
          tamanho: string
          venda_id: string
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          id?: string
          preco_unitario?: number
          quantidade?: number
          subtotal?: number
          tamanho?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_gelo_cubo_itens_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_gelo_cubo_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_itens: {
        Row: {
          factory_id: string | null
          id: string
          preco_unitario: number
          quantidade: number
          regra_preco_aplicada: string
          sabor_id: string
          subtotal: number
          venda_id: string
        }
        Insert: {
          factory_id?: string | null
          id?: string
          preco_unitario: number
          quantidade: number
          regra_preco_aplicada?: string
          sabor_id: string
          subtotal: number
          venda_id: string
        }
        Update: {
          factory_id?: string | null
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
            foreignKeyName: "venda_itens_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
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
          factory_id?: string | null
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
          factory_id?: string | null
          id?: string
          numero?: number
          paga?: boolean
          valor?: number
          vencimento?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_parcelas_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
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
          factory_id: string | null
          forma_pagamento: string
          frete_pago_por: string
          id: string
          numero_nf: string | null
          numero_pedido: number | null
          observacoes: string | null
          operador: string
          status: Database["public"]["Enums"]["status_venda"]
          total: number
          updated_at: string
          valor_especie: number
          valor_frete: number
          valor_pago: number
          valor_pix: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          enviado_producao?: boolean
          factory_id?: string | null
          forma_pagamento?: string
          frete_pago_por?: string
          id?: string
          numero_nf?: string | null
          numero_pedido?: number | null
          observacoes?: string | null
          operador?: string
          status?: Database["public"]["Enums"]["status_venda"]
          total?: number
          updated_at?: string
          valor_especie?: number
          valor_frete?: number
          valor_pago?: number
          valor_pix?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          enviado_producao?: boolean
          factory_id?: string | null
          forma_pagamento?: string
          frete_pago_por?: string
          id?: string
          numero_nf?: string | null
          numero_pedido?: number | null
          observacoes?: string | null
          operador?: string
          status?: Database["public"]["Enums"]["status_venda"]
          total?: number
          updated_at?: string
          valor_especie?: number
          valor_frete?: number
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
          {
            foreignKeyName: "vendas_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_excluidas: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          data_venda: string | null
          excluido_em: string
          excluido_por: string | null
          factory_id: string | null
          forma_pagamento: string | null
          id: string
          itens: Json
          motivo: string | null
          numero_nf: string | null
          observacoes: string | null
          operador: string | null
          parcelas: Json | null
          status: string | null
          total: number
          valor_especie: number | null
          valor_pago: number | null
          valor_pix: number | null
          venda_id: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          data_venda?: string | null
          excluido_em?: string
          excluido_por?: string | null
          factory_id?: string | null
          forma_pagamento?: string | null
          id?: string
          itens?: Json
          motivo?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          operador?: string | null
          parcelas?: Json | null
          status?: string | null
          total?: number
          valor_especie?: number | null
          valor_pago?: number | null
          valor_pix?: number | null
          venda_id: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          data_venda?: string | null
          excluido_em?: string
          excluido_por?: string | null
          factory_id?: string | null
          forma_pagamento?: string | null
          id?: string
          itens?: Json
          motivo?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          operador?: string | null
          parcelas?: Json | null
          status?: string | null
          total?: number
          valor_especie?: number | null
          valor_pago?: number | null
          valor_pix?: number | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_excluidas_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      video_aulas: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          factory_id: string | null
          id: string
          ordem: number
          titulo: string
          updated_at: string
          url_video: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          factory_id?: string | null
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
          url_video: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          factory_id?: string | null
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
          url_video?: string
        }
        Relationships: []
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
      get_user_factory_id: { Args: { _user_id: string }; Returns: string }
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      realizar_producao: {
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
      app_role:
        | "admin"
        | "producao"
        | "super_admin"
        | "factory_owner"
        | "vendedor"
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
      app_role: [
        "admin",
        "producao",
        "super_admin",
        "factory_owner",
        "vendedor",
      ],
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
