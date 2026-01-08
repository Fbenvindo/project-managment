import React from "react";
import { Calculator } from "lucide-react";

export default function OrcamentosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Orçamentos</h1>
              <p className="text-gray-600">Lista de orçamentos realizados</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Lista de Orçamentos
            </h3>
            <p className="text-gray-600">
              Em desenvolvimento
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}