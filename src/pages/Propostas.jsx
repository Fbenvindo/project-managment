import React from "react";
import { FileText } from "lucide-react";

export default function PropostasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Propostas</h1>
              <p className="text-gray-600">Apresentação de propostas comerciais</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Apresentação de Propostas
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