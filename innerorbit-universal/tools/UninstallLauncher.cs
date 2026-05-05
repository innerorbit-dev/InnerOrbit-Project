using System;
using System.Diagnostics;
using System.IO;

class UninstallLauncher
{
    static void Main()
    {
        // Define the app name exactly as it is in the installation path
        string appName = "CalcX Desktop";
        
        // Construct path: %LOCALAPPDATA%\Programs\CalcX Desktop\Uninstall CalcX Desktop.exe
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string uninstallPath = Path.Combine(localAppData, "Programs", appName, "Uninstall " + appName + ".exe");
        
        Console.WriteLine("---------------------------------------------------");
        Console.WriteLine("      CalcX Desktop Uninstaller Launcher");
        Console.WriteLine("---------------------------------------------------");
        
        if (File.Exists(uninstallPath))
        {
            Console.WriteLine("Found uninstaller at:");
            Console.WriteLine(uninstallPath);
            Console.WriteLine("\nLaunching uninstaller...");
            
            try
            {
                Process.Start(uninstallPath);
            }
            catch (Exception ex)
            {
                Console.WriteLine("\n[ERROR] Failed to launch uninstaller: " + ex.Message);
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
            }
        }
        else
        {
            Console.WriteLine("\n[ERROR] Uninstaller not found!");
            Console.WriteLine("\nExpected location: " + uninstallPath);
            Console.WriteLine("\nPossible reasons:");
            Console.WriteLine("1. The application is not installed.");
            Console.WriteLine("2. It was installed in a custom directory.");
            Console.WriteLine("\nPress any key to exit...");
            Console.ReadKey();
        }
    }
}
