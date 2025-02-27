import { mdiClose, mdiDownload, mdiKey } from "@mdi/js";
import type { CSSResultGroup } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { fireEvent } from "../../../../common/dom/fire_event";
import "../../../../components/ha-button";
import "../../../../components/ha-dialog-header";
import "../../../../components/ha-icon-button";
import "../../../../components/ha-icon-button-prev";
import "../../../../components/ha-md-dialog";
import type { HaMdDialog } from "../../../../components/ha-md-dialog";
import "../../../../components/ha-md-list";
import "../../../../components/ha-md-list-item";
import "../../../../components/ha-password-field";
import { generateEncryptionKey } from "../../../../data/backup";
import type { HassDialog } from "../../../../dialogs/make-dialog-manager";
import { haStyle, haStyleDialog } from "../../../../resources/styles";
import type { HomeAssistant } from "../../../../types";
import { fileDownload } from "../../../../util/file_download";
import type { ChangeBackupEncryptionKeyDialogParams } from "./show-dialog-change-backup-encryption-key";

const STEPS = ["current", "new", "save"] as const;

@customElement("ha-dialog-change-backup-encryption-key")
class DialogChangeBackupEncryptionKey extends LitElement implements HassDialog {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _opened = false;

  @state() private _step?: "current" | "new" | "save";

  @state() private _params?: ChangeBackupEncryptionKeyDialogParams;

  @query("ha-md-dialog") private _dialog!: HaMdDialog;

  @state() private _newEncryptionKey?: string;

  private _suggestedEncryptionKey?: string;

  public showDialog(params: ChangeBackupEncryptionKeyDialogParams): void {
    this._params = params;
    this._step = STEPS[0];
    this._opened = true;
    this._suggestedEncryptionKey = generateEncryptionKey();
  }

  public closeDialog(): void {
    if (this._params!.cancel) {
      this._params!.cancel();
    }
    if (this._opened) {
      fireEvent(this, "dialog-closed", { dialog: this.localName });
    }
    this._opened = false;
    this._step = undefined;
    this._params = undefined;
    this._newEncryptionKey = undefined;
    this._suggestedEncryptionKey = undefined;
  }

  private _done() {
    this._params?.submit!(true);
    this._dialog.close();
  }

  private _previousStep() {
    const index = STEPS.indexOf(this._step!);
    if (index === 0) {
      return;
    }
    this._step = STEPS[index - 1];
  }

  private _nextStep() {
    const index = STEPS.indexOf(this._step!);
    if (index === STEPS.length - 1) {
      return;
    }
    this._step = STEPS[index + 1];
  }

  protected render() {
    if (!this._opened || !this._params) {
      return nothing;
    }

    const dialogTitle =
      this._step === "current"
        ? "Save current encryption key"
        : this._step === "new"
          ? "New encryption key"
          : "Save new encryption key";

    return html`
      <ha-md-dialog disable-cancel-action open @closed=${this.closeDialog}>
        <ha-dialog-header slot="headline">
          ${this._step === "new"
            ? html`
                <ha-icon-button-prev
                  slot="navigationIcon"
                  @click=${this._previousStep}
                ></ha-icon-button-prev>
              `
            : html`
                <ha-icon-button
                  slot="navigationIcon"
                  .label=${this.hass.localize("ui.dialogs.generic.close")}
                  .path=${mdiClose}
                  @click=${this.closeDialog}
                ></ha-icon-button>
              `}
          <span slot="title">${dialogTitle}</span>
        </ha-dialog-header>
        <div slot="content">${this._renderStepContent()}</div>
        <div slot="actions">
          ${this._step === "current"
            ? html`<ha-button @click=${this._nextStep}>Next</ha-button>`
            : this._step === "new"
              ? html`
                  <ha-button
                    @click=${this._submit}
                    .disabled=${!this._newEncryptionKey}
                  >
                    Change encryption key
                  </ha-button>
                `
              : this._step === "save"
                ? html`<ha-button @click=${this._done}>Done</ha-button>`
                : nothing}
        </div>
      </ha-md-dialog>
    `;
  }

  private _renderStepContent() {
    switch (this._step) {
      case "current":
        return html`
          <p>
            Make sure you have saved the current encryption key to make sure you
            have access to all your current backups. All next backups will use
            the new encryption key.
          </p>
          <ha-md-list>
            <ha-md-list-item>
              <span slot="headline">Download emergency kit</span>
              <span slot="supporting-text">
                We recommend to save this encryption key somewhere secure.
              </span>
              <ha-button slot="end" @click=${this._downloadOld}>
                <ha-svg-icon .path=${mdiDownload} slot="icon"></ha-svg-icon>
                Download
              </ha-button>
            </ha-md-list-item>
          </ha-md-list>
        `;
      case "new":
        return html`
          <p>All next backups will use the new encryption key.</p>
          <ha-password-field
            placeholder="New encryption key"
            @input=${this._encryptionKeyChanged}
            .value=${this._newEncryptionKey || ""}
          ></ha-password-field>
          <ha-md-list>
            <ha-md-list-item>
              <ha-svg-icon slot="start" .path=${mdiKey}></ha-svg-icon>
              <span slot="headline">Use suggested encryption key</span>
              <span slot="supporting-text">
                ${this._suggestedEncryptionKey}
              </span>
              <ha-button slot="end" @click=${this._useSuggestedEncryptionKey}>
                Enter
              </ha-button>
            </ha-md-list-item>
          </ha-md-list>
        `;
      case "save":
        return html`
          <p>
            It’s important that you don’t lose this encryption key. We recommend
            to save this key somewhere secure. As you can only restore your data
            with the backup encryption key.
          </p>
          <ha-md-list>
            <ha-md-list-item>
              <span slot="headline">Download emergency kit</span>
              <span slot="supporting-text">
                We recommend to save this encryption key somewhere secure.
              </span>
              <ha-button slot="end" @click=${this._downloadNew}>
                <ha-svg-icon .path=${mdiDownload} slot="icon"></ha-svg-icon>
                Download
              </ha-button>
            </ha-md-list-item>
          </ha-md-list>
        `;
    }
    return nothing;
  }

  private _downloadOld() {
    if (!this._params?.currentKey) {
      return;
    }
    fileDownload(
      "data:text/plain;charset=utf-8," +
        encodeURIComponent(this._params.currentKey),
      "emergency_kit_old.txt"
    );
  }

  private _downloadNew() {
    if (!this._newEncryptionKey) {
      return;
    }
    fileDownload(
      "data:text/plain;charset=utf-8," +
        encodeURIComponent(this._newEncryptionKey),
      "emergency_kit.txt"
    );
  }

  private _encryptionKeyChanged(ev) {
    this._newEncryptionKey = ev.target.value;
  }

  private _useSuggestedEncryptionKey() {
    this._newEncryptionKey = this._suggestedEncryptionKey;
  }

  private async _submit() {
    if (!this._newEncryptionKey) {
      return;
    }
    this._params!.saveKey(this._newEncryptionKey);
    this._nextStep();
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      haStyleDialog,
      css`
        ha-md-dialog {
          width: 90vw;
          max-width: 500px;
        }
        div[slot="content"] {
          margin-top: -16px;
        }
        ha-md-list {
          background: none;
          --md-list-item-leading-space: 0;
          --md-list-item-trailing-space: 0;
        }
        @media all and (max-width: 450px), all and (max-height: 500px) {
          ha-md-dialog {
            max-width: none;
          }
          div[slot="content"] {
            margin-top: 0;
          }
        }
        p {
          margin-top: 0;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-dialog-change-backup-encryption-key": DialogChangeBackupEncryptionKey;
  }
}
