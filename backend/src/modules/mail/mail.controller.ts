import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { MailService } from './mail.service';

@ApiTags('mail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('templates')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'List email templates (resolved)' })
  listTemplates() {
    return this.mail.listTemplates();
  }

  @Get('templates/:name')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Get email template (resolved)' })
  getTemplate(@Param('name') name: string) {
    return this.mail.getTemplate(name);
  }

  @Put('templates/:name')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Update email template content (stored in DB)' })
  updateTemplate(@Param('name') name: string, @Body() body: { content: string }) {
    return this.mail.updateTemplate(name, body.content ?? '');
  }

  @Put('test')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Send test email using current SMTP settings' })
  sendTestEmail(
    @Body()
    body: {
      to: string;
      template: string;
      subject?: string;
      context?: Record<string, unknown>;
    },
  ) {
    return this.mail.sendTestEmail(body);
  }
}

