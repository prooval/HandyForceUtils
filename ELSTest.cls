@isTest
public class EmailLogServiceTest {
    
    @isTest
    static void testLoggingAndEmail() {
        Test.startTest();
        
        // Arrange
        EmailLogService logger = new EmailLogService();
        
        // Act - Logging some info, warnings, and error
        logger.info('This is an info log');
        logger.warn('This is a warning log');
        
        try {
            Integer x = 1 / 0;
        } catch(Exception e) {
            logger.error(e);
        }

        // Mock the send email functionality to prevent actual sending
        List<Messaging.Email> emailsSent = new List<Messaging.Email>();
        Messaging.Email[] mockEmails = new Messaging.Email[0];
        Test.setMock(HttpCalloutMock.class, new EmailServiceMock(emailsSent));
        
        // Act - Send email
        logger.sendEmail();
        
        Test.stopTest();
        
        // Assert - Ensure the logger behaves as expected
        // Here you can also add further validations like email subject, to address, and body
        System.assertEquals(1, emailsSent.size(), 'An email should have been sent');
    }
    
    public class EmailServiceMock implements HttpCalloutMock {
        List<Messaging.Email> emailsSent;

        public EmailServiceMock(List<Messaging.Email> emailsSent) {
            this.emailsSent = emailsSent;
        }

        public HTTPResponse respond(HTTPRequest req) {
            // Capture the email sent for assertion
            this.emailsSent.add((Messaging.SingleEmailMessage)JSON.deserialize(req.getBody(), Messaging.SingleEmailMessage.class));
            
            // Return a mocked response
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            return res;
        }
    }
}
