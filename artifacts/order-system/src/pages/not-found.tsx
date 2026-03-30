import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-24 w-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
            <AlertCircle className="h-12 w-12" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          404 - Sahifa topilmadi
        </h1>
        
        <p className="text-muted-foreground text-lg">
          Kechirasiz, siz qidirayotgan sahifa mavjud emas yoki o'chirilgan bo'lishi mumkin.
        </p>

        <div className="pt-4">
          <Link href="/">
            <Button size="lg" className="w-full sm:w-auto font-medium">
              Bosh sahifaga qaytish
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
