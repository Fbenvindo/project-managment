import { useState, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save } from "lucide-react";
import { motion } from "framer-motion";
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';

export default function UsuarioForm({ usuario, onSubmit, onCancel }) {
  const { user } = useContext(ActivityTimerContext);
  const [formData, setFormData] = useState({
    nome: usuario?.nome || "",
    email: usuario?.email || "",
    cargo: usuario?.cargo || "",
    departamento: usuario?.departamento || "",
    telefone: usuario?.telefone || "",
    data_admissao: usuario?.data_admissao || "",
    status: usuario?.status || "ativo",
    perfil: usuario?.perfil || "user" // Added 'perfil' field with default 'user'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  // **NOVO**: Determinar perfis disponíveis baseado no usuário logado
  const getAvailableProfiles = () => {
    // Admin e Direção têm acesso a todos os perfis
    if (user?.role === 'admin' || user?.perfil === 'direcao') {
      return [
        { value: 'user', label: 'Colaborador' },
        { value: 'coordenador', label: 'Coordenador' },
        { value: 'apoio', label: 'Apoio' },
        { value: 'gestao', label: 'Gestão' },
        { value: 'lider', label: 'Líder' },
        { value: 'direcao', label: 'Direção' },
        { value: 'admin', label: 'Administrador' },
      ];
    }
    
    // Líder pode criar apenas colaboradores, coordenadores, apoio e gestão
    if (user?.perfil === 'lider') {
      return [
        { value: 'user', label: 'Colaborador' },
        { value: 'coordenador', label: 'Coordenador' },
        { value: 'apoio', label: 'Apoio' },
        { value: 'gestao', label: 'Gestão' },
      ];
    }
    
    // Outros usuários (não deveriam chegar aqui, mas por segurança)
    return [
      { value: 'user', label: 'Colaborador' },
    ];
  };

  const availableProfiles = getAvailableProfiles();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="bg-white shadow-2xl">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">
                {usuario ? "Editar Usuário" : "Novo Usuário"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange("nome", e.target.value)}
                    placeholder="Digite o nome completo"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={formData.cargo}
                    onChange={(e) => handleInputChange("cargo", e.target.value)}
                    placeholder="Ex: Analista, Gerente"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    value={formData.departamento}
                    onChange={(e) => handleInputChange("departamento", e.target.value)}
                    placeholder="Ex: TI, RH, Financeiro"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange("telefone", e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="data_admissao">Data de Admissão</Label>
                  <Input
                    id="data_admissao"
                    type="date"
                    value={formData.data_admissao}
                    onChange={(e) => handleInputChange("data_admissao", e.target.value)}
                  />
                </div>
              </div>

              {/* **MODIFICADO**: Perfil de Acesso Select - agora com opções filtradas */}
              <div className="space-y-2">
                <Label htmlFor="perfil">Perfil de Acesso</Label>
                <Select
                  value={formData.perfil}
                  onValueChange={(value) => handleInputChange("perfil", value)}
                >
                  <SelectTrigger id="perfil">
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map(profile => (
                      <SelectItem key={profile.value} value={profile.value}>
                        {profile.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(user?.role === 'admin' || user?.perfil === 'direcao') && (
                  <p className="text-xs text-gray-500">
                    <strong>Direção:</strong> Acesso completo incluindo aba de Gestão nos empreendimentos
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}