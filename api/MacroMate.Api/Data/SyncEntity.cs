namespace MacroMate.Api.Data;

public abstract class SyncEntity
{
    public Guid Id { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public long Version { get; set; }

    public virtual void KeepServerFieldsFrom(SyncEntity existing)
    {
        Id = existing.Id;
        CreatedAt = existing.CreatedAt;
        DeletedAt = existing.DeletedAt;
    }
}

public abstract class SharedEntity : SyncEntity
{
    public Guid CreatedBy { get; set; }

    public override void KeepServerFieldsFrom(SyncEntity existing)
    {
        base.KeepServerFieldsFrom(existing);
        CreatedBy = ((SharedEntity)existing).CreatedBy;
    }
}

public abstract class PersonalEntity : SyncEntity
{
    public Guid UserId { get; set; }

    public override void KeepServerFieldsFrom(SyncEntity existing)
    {
        base.KeepServerFieldsFrom(existing);
        UserId = ((PersonalEntity)existing).UserId;
    }
}
