public class EmailLogService {
    
    private List<Log> logs;
    
    public EmailLogService() {
        this.logs = new List<Log>();
    }

    public class Log {
        String message;
        String level;
        DateTime timestamp;

        public Log(String level, String message) {
            this.level = level;
            this.message = message;
            this.timestamp = DateTime.now();
        }
        
        public String toHTML() {
            String color = 'black';
            if(level == 'ERROR') color = 'red';
            else if(level == 'WARN') color = 'orange';
            else if(level == 'INFO') color = 'blue';

            return '<p style="color: ' + color + ';">[' + timestamp.format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'') + '][' + level + '] ' + message + '</p><hr/>';
        }
    }

    public void info(String message) {
        logs.add(new Log('INFO', message));
    }

    public void warn(String message) {
        logs.add(new Log('WARN', message));
    }

    public void error(Exception e) {
        logs.add(new Log('ERROR', e.getMessage() + '. Stack Trace: ' + e.getStackTraceString()));
    }

    public void sendEmail() {
        if(logs.isEmpty()) return; // Don't send an email if there are no logs

        Map<String, Integer> summary = new Map<String, Integer>();
        String emailBody = '<html><body>';

        for(Log log : logs) {
            emailBody += log.toHTML();
            summary.put(log.level, summary.containsKey(log.level) ? summary.get(log.level) + 1 : 1);
        }

        // Add summary
        emailBody += '<hr/><h3>Log Summary:</h3><ul>';
        for(String level : summary.keySet()) {
            emailBody += '<li>' + level + ': ' + summary.get(level) + '</li>';
        }
        emailBody += '</ul>';

        emailBody += '</body></html>';

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[] {'recipient@example.com'});
        mail.setSubject('Log Report');
        mail.setHtmlBody(emailBody);

        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
    }
}
