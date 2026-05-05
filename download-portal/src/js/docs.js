// Angular Docs Module
var app = angular.module('docsApp', []);
app.controller('DocsController', function($scope) {
    $scope.platforms = [
        {
            name: 'Installation Guide: Play Store',
            steps: ['Open Google Play Store on your device', 'Search for "CalcX"', 'Tap on the "Install" button', 'Launch the app and Sign up']
        },
        {
            name: 'Installation Guide: Windows',
            steps: ['Download the CalcX.exe file', 'Right click > Run as Administrator', 'Follow the installer prompt', 'Launch from Desktop']
        }
    ];
});

// Manual Bootstrap
angular.element(document).ready(function() {
    const angularRoot = document.getElementById('angular-docs-root');
    if (angularRoot) {
        angular.bootstrap(angularRoot, ['docsApp']);
    }
});
