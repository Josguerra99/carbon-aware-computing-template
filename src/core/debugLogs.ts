export namespace Logger{
    export let AllowDebugLogs = false;
    
    export function log(message: string){
        if (AllowDebugLogs) console.log(message);
    }
}