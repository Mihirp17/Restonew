import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { QrCode, Pencil, Trash } from "lucide-react";
import { useLang } from "@/contexts/language-context";

interface Table {
  id: number;
  number: number;
  qrCode: string;
  restaurantId: number;
  isOccupied: boolean;
}

interface TableCardProps {
  table: Table;
  onEdit: () => void;
  onDelete: () => void;
  onToggleOccupied: () => void;
}

export function TableCard({ table, onEdit, onDelete, onToggleOccupied }: TableCardProps) {
  const { t } = useLang();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  const handleDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className={`${table.isOccupied ? 'border-[#ba1d1d]' : ''}`}>
        <CardContent className="p-4 text-center">
          <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${table.isOccupied ? 'bg-[#ba1d1d] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            <span className="text-lg font-bold">{table.number}</span>
          </div>
          <h3 className="font-medium">{t('tables.card.title', { number: table.number })}</h3>
          <Badge className="mt-2" variant={table.isOccupied ? "default" : "outline"}>
            {table.isOccupied ? t('tables.card.status.occupied') : t('tables.card.status.free')}
          </Badge>
        </CardContent>
        <CardFooter className="grid grid-cols-3 gap-1 p-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsQrDialogOpen(true)}
            className="hover:bg-blue-50 hover:text-blue-600 transition-colors flex flex-col items-center gap-1 h-auto py-2"
            title={t('tables.card.button.qrCode')}
          >
            <QrCode className="h-4 w-4" />
            <span className="text-xs">{t('tables.card.button.qrCode')}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onEdit}
            className="hover:bg-green-50 hover:text-green-600 transition-colors flex flex-col items-center gap-1 h-auto py-2"
            title={t('edit')}
          >
            <Pencil className="h-4 w-4" />
            <span className="text-xs">{t('edit')}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsDeleteDialogOpen(true)}
            className="hover:bg-red-50 hover:text-red-600 transition-colors flex flex-col items-center gap-1 h-auto py-2"
            title={t('delete')}
          >
            <Trash className="h-4 w-4" />
            <span className="text-xs">{t('delete')}</span>
          </Button>
        </CardFooter>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tables.card.deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('tables.card.deleteDialog.description', { number: table.number })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
            >
              {t('cancel')}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
            >
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* QR Code Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('tables.card.qrDialog.title', { number: table.number })}</DialogTitle>
            <DialogDescription>
              {t('tables.card.qrDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center my-4">
            <img src={table.qrCode} alt={`QR Code for Table ${table.number}`} className="max-w-full h-auto" />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsQrDialogOpen(false)}
              className="border-[#373643]/20 text-[#373643] hover:bg-[#373643]/5"
            >
              {t('close')}
            </Button>
            <Button 
              variant="default"
              onClick={() => {
                // Create a download link for the QR code
                const a = document.createElement('a');
                a.href = table.qrCode;
                a.download = `table-${table.number}-qr-code.png`;
                a.click();
              }}
              className="bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
            >
              {t('tables.card.qrDialog.button.download')}
            </Button>
            <Button
              variant={table.isOccupied ? "destructive" : "default"}
              onClick={() => {
                onToggleOccupied();
                setIsQrDialogOpen(false);
              }}
              className={table.isOccupied 
                ? "bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
                : "bg-[#ba1d1d] hover:bg-[#ba1d1d]/90 text-white transition-all duration-200"
              }
            >
              {t('tables.card.qrDialog.button.markAs', { status: table.isOccupied ? t('tables.card.status.free') : t('tables.card.status.occupied') })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
