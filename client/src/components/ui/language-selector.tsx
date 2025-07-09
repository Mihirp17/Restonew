import React from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLang } from '@/contexts/language-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface LanguageOption {
  code: 'en' | 'es' | 'ca';
  name: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ca', name: 'Català', flag: '🔥' },
];

export function LanguageSelector() {
  const { lang, setLang } = useLang();

  const currentLanguage = languages.find(l => l.code === lang) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Globe className="h-4 w-4 mr-2" />
          <span className="mr-1">{currentLanguage.flag}</span>
          <span className="hidden sm:inline mr-1">{currentLanguage.name}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => setLang(language.code)}
            className={`cursor-pointer ${
              lang === language.code 
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <span className="mr-2">{language.flag}</span>
            <span>{language.name}</span>
            {lang === language.code && (
              <span className="ml-auto h-2 w-2 bg-red-500 rounded-full"></span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 